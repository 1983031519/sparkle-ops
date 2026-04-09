import { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

const BUCKET = 'job-photos'

interface Props {
  jobId: string
  photos: string[]
  onPhotosChange: (photos: string[]) => void
}

export function PhotoUpload({ jobId, photos, onPhotosChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  async function ensureBucket() {
    // Try to create the bucket — ignore error if it already exists
    await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 10485760 })
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      await ensureBucket()
      const newUrls: string[] = []

      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() ?? 'jpg'
        const fileName = `${jobId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

        const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        })

        if (error) {
          toast.error(`Upload failed: ${error.message}`)
          continue
        }

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName)
        if (urlData?.publicUrl) {
          newUrls.push(urlData.publicUrl)
        }
      }

      if (newUrls.length > 0) {
        const updated = [...photos, ...newUrls]
        onPhotosChange(updated)
        // Save to DB immediately
        await supabase.from('jobs').update({ photos: updated } as never).eq('id', jobId)
        toast.success(`${newUrls.length} photo${newUrls.length > 1 ? 's' : ''} uploaded.`)
      }
    } catch (err) {
      toast.error(`Upload error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDelete(url: string) {
    // Extract the file path from the URL
    const path = url.split(`/storage/v1/object/public/${BUCKET}/`)[1]
    if (path) {
      await supabase.storage.from(BUCKET).remove([path])
    }
    const updated = photos.filter(p => p !== url)
    onPhotosChange(updated)
    await supabase.from('jobs').update({ photos: updated } as never).eq('id', jobId)
    toast.success('Photo deleted.')
  }

  return (
    <div className="border rounded-lg border-stone-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Photos
          {photos.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-navy-900/10 px-2 py-0.5 text-[11px] font-semibold text-navy-900">
              {photos.length}
            </span>
          )}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {photos.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-200 py-8 text-stone-400 cursor-pointer hover:border-stone-300 hover:text-stone-500 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon className="h-8 w-8 mb-2" />
          <p className="text-[12px]">Click to upload before/after photos</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, i) => (
            <div key={i} className="group relative aspect-square rounded-lg overflow-hidden bg-stone-100">
              <img
                src={url}
                alt={`Job photo ${i + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <button
                type="button"
                onClick={() => handleDelete(url)}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
