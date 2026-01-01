import React, { useState } from 'react'
import { Progress } from "@/components/ui/progress"

const ImageUpload = ({ onImageUpload }) => {
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const previewUrl = URL.createObjectURL(file)
    setImagePreview(null)
    setUploading(true)
    setProgress(0)

    let current = 0
    const interval = setInterval(() => {
      current += 10
      setProgress(current)

      if (current >= 100) {
        clearInterval(interval)
        setUploading(false)
        setImagePreview(previewUrl)
        
        // ------------------------------------------------
        // ✅ FIX: Send the FILE object, not the URL string
        // ------------------------------------------------
        onImageUpload(file) 
      }
    }, 300)
  }

  return (
    <div className='w-full h-30 rounded-xl p-5 flex gap-5 items-center bg-[#eaeaea83]'>
      <div className='bg-[#93939368] w-20 aspect-square rounded-xl'>
        {imagePreview && !uploading && (
          <img
            src={imagePreview}
            alt="Uploaded Preview"
            className="z-10 rounded-lg shadow-md border w-full h-auto object-cover"
          />
        )}
      </div>
      <div className='w-full'>
        <p>Product Image</p>

        {!progress && (
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="p-2 rounded cursor-pointer"
          />
        )}

        {uploading && (
          <div className="w-full">
            <p className="text-sm mb-1">Uploading... {progress}%</p>
            <Progress value={progress} className="w-full h-2" />
          </div>
        )}

        {progress === 100 && (
          <p className="text-green-600 font-bold text-center">
            Upload Complete ✅
          </p>
        )}
      </div>
    </div>
  )
}

export default ImageUpload