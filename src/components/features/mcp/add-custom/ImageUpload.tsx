import React, { useRef, useState } from "react"
import { Image as ImageIcon, Link as LinkIcon, Upload } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "../../../ui/primitives/popover/Popover"

interface ImageUploadProps {
  imageData: string
  onImageChange: (imageData: string) => void
  onError: (error: string) => void
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ imageData, onImageChange, onError }) => {
  const [showImageOptions, setShowImageOptions] = useState(false)
  const [imageInputUrl, setImageInputUrl] = useState("")
  const [isValidatingImage, setIsValidatingImage] = useState(false)
  const [imageError, setImageError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateImageUrl = async (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = url
      setTimeout(() => resolve(false), 5000)
    })
  }

  const handleImageUrlSubmit = async () => {
    if (!imageInputUrl.trim()) {
      setImageError("Please enter an image URL")
      onError("Please enter an image URL")
      return
    }

    setIsValidatingImage(true)
    setImageError("")

    const isValid = await validateImageUrl(imageInputUrl)
    setIsValidatingImage(false)

    if (isValid) {
      onImageChange(imageInputUrl)
      setShowImageOptions(false)
      setImageInputUrl("")
      setImageError("")
      onError("")
    } else {
      const error = "Invalid image URL or image failed to load"
      setImageError(error)
      onError(error)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      const error = "Please select a valid image file"
      setImageError(error)
      onError(error)
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      onImageChange(base64)
      setShowImageOptions(false)
      setImageError("")
      onError("")
    }
    reader.onerror = () => {
      const error = "Failed to read image file"
      setImageError(error)
      onError(error)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    onImageChange("")
    setImageError("")
    onError("")
  }

  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: "0.875rem",
          fontWeight: 500,
          marginBottom: "0.25rem",
          color: "var(--text-primary)"
        }}>
        Server Image <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>(optional)</span>
      </label>
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--text-secondary, rgba(255, 255, 255, 0.6))",
          marginBottom: "0.5rem"
        }}>
        Recommended size: 200x200 px
      </div>

      {!imageData ? (
        <Popover open={showImageOptions} onOpenChange={setShowImageOptions}>
          <PopoverTrigger asChild>
            <button
              type="button"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.625rem 0.75rem",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "6px",
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                width: "100%",
                justifyContent: "center"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"
                e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.5)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)"
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)"
              }}>
              <ImageIcon size={16} />
              Add Image?
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            style={{
              width: "320px",
              padding: "1rem",
              backgroundColor: "rgba(15, 20, 32, 0.98)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)"
            }}>
            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--text-primary)"
                }}>
                <LinkIcon size={14} />
                Add via URL
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="url"
                  value={imageInputUrl}
                  onChange={(e) => {
                    setImageInputUrl(e.target.value)
                    setImageError("")
                  }}
                  placeholder="https://example.com/icon.png"
                  disabled={isValidatingImage}
                  style={{
                    flex: 1,
                    padding: "0.5rem 0.75rem",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    border: `1px solid ${imageError ? "rgb(239, 68, 68)" : "rgba(255, 255, 255, 0.1)"}`,
                    borderRadius: "6px",
                    fontSize: "0.8125rem",
                    color: "var(--text-primary)",
                    outline: "none"
                  }}
                />
                <button
                  type="button"
                  onClick={handleImageUrlSubmit}
                  disabled={isValidatingImage || !imageInputUrl.trim()}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: isValidatingImage ? "rgba(59, 130, 246, 0.5)" : "rgb(59, 130, 246)",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "#fff",
                    cursor: isValidatingImage || !imageInputUrl.trim() ? "not-allowed" : "pointer",
                    opacity: isValidatingImage || !imageInputUrl.trim() ? 0.6 : 1
                  }}>
                  {isValidatingImage ? "Validating..." : "Add"}
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                margin: "1rem 0",
                color: "var(--text-secondary)",
                fontSize: "0.8125rem"
              }}>
              <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(255, 255, 255, 0.1)" }} />
              OR
              <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(255, 255, 255, 0.1)" }} />
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--text-primary)"
                }}>
                <Upload size={14} />
                Upload from device
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "6px",
                  fontSize: "0.8125rem",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)"
                }}>
                Choose File
              </button>
            </div>

            {imageError && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.5rem 0.75rem",
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "6px",
                  fontSize: "0.8125rem",
                  color: "rgb(239, 68, 68)"
                }}>
                {imageError}
              </div>
            )}
          </PopoverContent>
        </Popover>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.75rem",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "6px"
          }}>
          <img
            src={imageData}
            alt="Server icon"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "6px",
              objectFit: "cover"
            }}
          />
          <span style={{ flex: 1, fontSize: "0.875rem", color: "var(--text-primary)" }}>
            Image added
          </span>
          <button
            type="button"
            onClick={handleRemoveImage}
            style={{
              padding: "0.375rem 0.75rem",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "4px",
              fontSize: "0.8125rem",
              color: "rgb(239, 68, 68)",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.2)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)"
            }}>
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
