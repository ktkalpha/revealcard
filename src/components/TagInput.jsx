import React, { useId, useState } from 'react'
import { Folder, X } from 'lucide-react'
import { MAX_TAGS, MAX_TAG_LENGTH, folderLabel, normalizeTag } from '../lib/tags'

// Folder chips for one card. "과학/물리" puts the card in 물리 inside 과학.
export default function TagInput({ tags = [], folders = [], onChange }) {
  const [text, setText] = useState('')
  const listId = useId()
  const add = (value) => {
    const tag = normalizeTag(value)
    setText('')
    if (!tag || tag.length > MAX_TAG_LENGTH || tags.includes(tag) || tags.length >= MAX_TAGS) return
    onChange([...tags, tag])
  }
  return (
    <div className="tag-input">
      <Folder size={15} aria-hidden="true" />
      {tags.map((tag) => (
        <span key={tag} className="tag-chip">
          {folderLabel(tag)}
          <button type="button" aria-label={`${tag} 폴더에서 빼기`} onClick={() => onChange(tags.filter((item) => item !== tag))}>
            <X size={12} />
          </button>
        </span>
      ))}
      {tags.length < MAX_TAGS && (
        <input
          aria-label="폴더(태그) 추가"
          list={listId}
          value={text}
          maxLength={MAX_TAG_LENGTH + 10}
          placeholder={tags.length ? '폴더 추가' : '폴더(태그) — 예: 과학/물리'}
          onChange={(e) => {
            // Picking a suggestion or typing a comma adds the folder right away.
            const value = e.target.value
            if (value.endsWith(',')) add(value.slice(0, -1))
            else if (folders.some((folder) => folder.path === value) && e.nativeEvent.inputType === 'insertReplacementText') add(value)
            else setText(value)
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            if (e.key === 'Enter') {
              e.preventDefault()
              add(text)
            } else if (e.key === 'Backspace' && !text && tags.length) onChange(tags.slice(0, -1))
          }}
          onBlur={() => text.trim() && add(text)}
        />
      )}
      <datalist id={listId}>
        {folders.filter((folder) => !tags.includes(folder.path)).map((folder) => <option key={folder.path} value={folder.path} />)}
      </datalist>
    </div>
  )
}
