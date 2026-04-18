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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      const newUrls: string[] = []

      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast.error(`"${file.name}" is not an image file.`)
          continue
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`"${file.name}" exceeds 10MB limit.`)
          continue
        }

        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const fileName = `${jobId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

        console.log(`[PhotoUpload] Uploading: ${fileName} (${file.type}, ${(file.size / 1024).toFixed(0)}KB)`)

        const { data, error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

        if (error) {
          console.error('[PhotoUpload] Upload error:', error)

          if (error.message.includes('Bucket not found') || error.message.includes('not found')) {
            toast.error('Storage bucket "job-photos" not found. Please create it in Supabase Dashboard → Storage → New Bucket → name: job-photos, Public: ON')
            setUploading(false)
            return
          }
          if (error.message.includes('security') || error.message.includes('policy')) {
            toast.error('Storage permission denied. Storage RLS policies need to be configured in Supabase.')
            setUploading(false)
            return
          }

          toast.error(`Upload failed for "${file.name}": ${error.message}`)
          continue
        }

        console.log('[PhotoUpload] Upload success:', data)

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName)
        if (urlData?.publicUrl) {
          newUrls.push(urlData.publicUrl)
        }
      }

      if (newUrls.length > 0) {
        const updated = [...photos, ...newUrls]
        onPhotosChange(updated)

        // Save to DB
        const { error: dbError } = await supabase.from('jobs').update({ photos: updated } as never).eq('id', jobId)
        if (dbError) {
          console.error('[PhotoUpload] DB save error:', dbError)
          toast.error(`Photos uploaded but failed to save to job: ${dbError.message}`)
          return
        }

        toast.success(`${newUrls.length} photo${newUrls.length > 1 ? 's' : ''} uploaded.`)
      }
    } catch (err) {
      console.error('[PhotoUpload] Unexpected error:', err)
      toast.error(`Upload error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDelete(url: string) {
    const path = url.split(`/storage/v1/object/public/${BUCKET}/`)[1]
    if (path) {
      const { error } = await supabase.storage.from(BUCKET).remove([path])
      if (error) console.error('[PhotoUpload] Delete from storage error:', error)
    }
    const updated = photos.filter(p => p !== url)
    onPhotosChange(updated)
    const { error: dbError } = await supabase.from('jobs').update({ photos: updated } as never).eq('id', jobId)
    if (dbError) {
      toast.error(`Failed to update job: ${dbError.message}`)
      return
    }
    toast.success('Photo removed.')
  }

  return (
    <div className="border rounded-lg border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Photos
          {photos.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-[#EEF1FE] px-2 py-0.5 text-micro font-semibold text-[#4F6CF7]">
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
          {uploading ? 'Uploading...' : 'Upload Photos'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {photos.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-8 text-gray-400 cursor-pointer hover:border-gray-300 hover:text-gray-500 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon className="h-8 w-8 mb-2" />
          <p className="text-eyebrow">Click to upload before/after photos</p>
          <p className="text-micro mt-1">JPG, PNG, WebP — max 10MB each</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {photos.map((url, i) => (
              <div key={i} className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100">
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
            {/* Add more button */}
            <div
              className="flex items-center justify-center aspect-square rounded-lg border-2 border-dashed border-gray-200 cursor-pointer hover:border-gray-300 text-gray-400 hover:text-gray-500 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-5 w-5" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
