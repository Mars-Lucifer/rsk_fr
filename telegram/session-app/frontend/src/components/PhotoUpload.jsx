import React, { useState, useRef } from 'react';

export default function PhotoUpload({ sessionId, userId, taskId, role, currentPhoto, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);

    setUploading(true);
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('userId', userId);
    formData.append('taskId', taskId);
    formData.append('role', role);

    try {
      const res = await fetch(`/api/upload/${sessionId}`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.ok) {
        onUploaded();
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }

  const photoSrc = preview || (currentPhoto ? `/${currentPhoto}` : null);

  return (
    <div className="photo-upload">
      {photoSrc && (
        <div className="photo-preview">
          <img src={photoSrc} alt="Uploaded" />
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleUpload}
        style={{ display: 'none' }}
      />
      <button
        className="btn btn-upload"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? 'Загрузка...' : currentPhoto ? 'Заменить фото' : 'Загрузить фото'}
      </button>
    </div>
  );
}
