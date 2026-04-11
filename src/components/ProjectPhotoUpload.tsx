import { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

const BUCKET = 'project-photos'

interface Props {
  folder: string
  photos: string[]
  onPhotosChange: (photos: string[]) => void
  /** If provided, immediately persists photos to this DB row after upload/delete */
  persistTo?: { table: string; id: string; column: string }
  maxPhotos?: number
  label?: string
}

export function ProjectPhotoUpload({ folder, photos, onPhotosChange, persistTo, maxPhotos = 6, label = 'Photos' }: Props) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  async function persistToDB(urls: string[]) {
    if (!persistTo) return
    console.log(`[ProjectPhoto] Persisting ${urls.length} photos to ${persistTo.table}.${persistTo.column} id=${persistTo.id}`)
    const { error } = await supabase.from(persistTo.table).update({ [persistTo.column]: urls } as never).eq('id', persistTo.id)
    if (error) {
      console.error('[ProjectPhoto] DB persist error:', error)
      toast.error(`Failed to save photos to database: ${error.message}`)
    } else {
      console.log('[ProjectPhoto] DB persist success')
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    const remaining = maxPhotos - photos.length
    if (remaining <= 0) { toast.error(`Maximum ${maxPhotos} photos allowed.`); return }

    setUploading(true)
    try {
      const newUrls: string[] = []
      const toUpload = Array.from(files).slice(0, remaining)

      for (const file of toUpload) {
        if (!file.type.startsWith('image/')) { toast.error(`"${file.name}" is not an image.`); continue }
        if (file.size > 10 * 1024 * 1024) { toast.error(`"${file.name}" exceeds 10MB.`); continue }

        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`

        console.log(`[ProjectPhoto] Uploading: ${fileName}`)
        const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, { cacheControl: '3600', upsert: false, contentType: file.type })

        if (error) {
          console.error('[ProjectPhoto] Storage upload error:', error)
          if (error.message.includes('not found')) {
            toast.error("Bucket 'project-photos' not found. Create it in Supabase Dashboard → Storage → New Bucket → Public: ON")
            break
          }
          toast.error(`Upload failed: ${error.message}`)
          continue
        }

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName)
        if (urlData?.publicUrl) {
          console.log('[ProjectPhoto] Got URL:', urlData.publicUrl)
          newUrls.push(urlData.publicUrl)
        }
      }

      if (newUrls.length > 0) {
        const updated = [...photos, ...newUrls]
        onPhotosChange(updated)
        await persistToDB(updated)
        toast.success(`${newUrls.length} photo${newUrls.length > 1 ? 's' : ''} uploaded.`)
      }
    } catch (err) {
      console.error('[ProjectPhoto] Unexpected error:', err)
      toast.error(`Upload error: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleRemove(url: string) {
    const path = url.split(`/storage/v1/object/public/${BUCKET}/`)[1]
    if (path) supabase.storage.from(BUCKET).remove([path])
    const updated = photos.filter(p => p !== url)
    onPhotosChange(updated)
    await persistToDB(updated)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6B7280' }}>
          <ImageIcon size={14} strokeWidth={1.5} className="inline mr-1 -mt-0.5" />{label} ({photos.length}/{maxPhotos})
        </span>
        {photos.length < maxPhotos && (
          <Button variant="ghost" size="sm" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} strokeWidth={1.5} />}
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleUpload} />
      </div>

      {photos.length === 0 ? (
        <div
          onClick={() => fileRef.current?.click()}
          style={{ border: '2px dashed #E5E7EB', borderRadius: 10, padding: '16px 0', textAlign: 'center', cursor: 'pointer', color: '#9CA3AF', fontSize: 12, transition: 'border-color 150ms' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#4F6CF7' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
        >
          Click to upload photos
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {photos.map((url, i) => (
            <div key={i} className="group" style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 8, overflow: 'hidden', background: '#F3F4F6' }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
              <button type="button" onClick={() => handleRemove(url)} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 12, padding: 3, cursor: 'pointer', opacity: 0, transition: 'opacity 150ms' }} className="group-hover:!opacity-100">
                <X size={12} color="white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
