'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Pencil, Save, X, Plus, Minus, Link2, Bold, Type, List, Heading1, Heading2 } from 'lucide-react'
import { getCurrentUser } from '@/lib/supabase'

export default function PageEditor({ slug, initialTitle, initialContent }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [fontSize, setFontSize] = useState(16)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkText, setLinkText] = useState('')
  const [linkUrl, setLinkUrl] = useState('/')
  const textareaRef = useRef(null)

  useEffect(() => {
    getCurrentUser().then(user => {
      if (user) {
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&select=role`, {
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${user.access_token}`
          }
        }).then(r => r.json()).then(data => {
          setIsAdmin(data[0]?.role === 'admin')
        }).catch(() => {})
      }
    }).catch(() => {})
  }, [])

  const insertTag = useCallback((tag, attrs = '') => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = content.substring(start, end)
    let replacement
    if (tag === 'ul') {
      replacement = `<ul>\n<li>${selected || 'العنصر'}</li>\n</ul>`
    } else if (tag === 'a') {
      setShowLinkModal(true)
      setLinkText(selected)
      return
    } else if (tag === 'h2') {
      replacement = `<h2>${selected || 'العنوان الفرعي'}</h2>`
    } else if (tag === 'h1') {
      replacement = `<h1>${selected || 'العنوان الرئيسي'}</h1>`
    } else if (tag === 'strong') {
      replacement = `<strong>${selected || 'النص'}</strong>`
    } else {
      replacement = `<${tag}${attrs ? ' ' + attrs : ''}>${selected || 'النص'}</${tag}>`
    }
    const newContent = content.substring(0, start) + replacement + content.substring(end)
    setContent(newContent)
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = start + replacement.length
      ta.selectionEnd = start + replacement.length
    }, 0)
  }, [content])

  const insertLink = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const linkHtml = `<a href="${linkUrl}">${linkText || linkUrl}</a>`
    const newContent = content.substring(0, start) + linkHtml + content.substring(end)
    setContent(newContent)
    setShowLinkModal(false)
    setLinkText('')
    setLinkUrl('/')
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = start + linkHtml.length
      ta.selectionEnd = start + linkHtml.length
    }, 0)
  }, [content, linkText, linkUrl])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/legal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, title, content })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setMessage('تم الحفظ بنجاح')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setMessage('خطأ: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8 text-red-600">{title}</h1>
        <div
          className="space-y-6 text-gray-300 leading-relaxed"
          style={{ fontSize: `${fontSize}px` }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    )
  }

  if (!editing) {
    return (
      <div>
        <div className="flex items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold text-red-600 flex-1">{title}</h1>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm transition"
          >
            <Pencil className="w-4 h-4" />
            تعديل
          </button>
        </div>
        <div className="space-y-6 text-gray-300 leading-relaxed"
          style={{ fontSize: `${fontSize}px` }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white text-xl font-bold focus:border-red-500 focus:outline-none"
          placeholder="عنوان الصفحة"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-white font-bold transition"
        >
          <Save className="w-4 h-4" />
          {saving ? 'جاري الحفظ...' : 'حفظ'}
        </button>
        <button
          onClick={() => { setEditing(false); setTitle(initialTitle); setContent(initialContent) }}
          className="flex items-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition"
        >
          <X className="w-4 h-4" />
          إلغاء
        </button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${
          message.includes('خطأ') ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'
        }`}>{message}</div>
      )}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-gray-400 text-sm ml-2">حجم الخط:</span>
        <button onClick={() => setFontSize(s => Math.max(12, s - 2))} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition"><Minus className="w-4 h-4" /></button>
        <span className="text-white text-sm w-12 text-center">{fontSize}px</span>
        <button onClick={() => setFontSize(s => Math.min(32, s + 2))} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition"><Plus className="w-4 h-4" /></button>

        <div className="w-px h-6 bg-gray-700 mx-2" />

        <button onClick={() => insertTag('h1')} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition" title="عنوان رئيسي"><Heading1 className="w-4 h-4" /></button>
        <button onClick={() => insertTag('h2')} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition" title="عنوان فرعي"><Heading2 className="w-4 h-4" /></button>
        <button onClick={() => insertTag('strong')} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition" title="نص عريض"><Bold className="w-4 h-4" /></button>
        <button onClick={() => insertTag('ul')} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition" title="قائمة"><List className="w-4 h-4" /></button>
        <button onClick={() => insertTag('a')} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition" title="رابط"><Link2 className="w-4 h-4" /></button>
      </div>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={e => setContent(e.target.value)}
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-300 focus:border-red-500 focus:outline-none resize-y"
        style={{ fontSize: `${fontSize}px`, minHeight: '400px', direction: 'rtl', lineHeight: '1.8' }}
        placeholder="محتوى الصفحة..."
      />

      <div className="mt-6">
        <h3 className="text-sm text-gray-400 mb-2">معاينة:</h3>
        <div
          className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-gray-300 leading-relaxed"
          style={{ fontSize: `${fontSize}px` }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>

      {showLinkModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">إضافة رابط</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">نص الرابط</label>
                <input
                  type="text"
                  value={linkText}
                  onChange={e => setLinkText(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-red-500 focus:outline-none"
                  placeholder="مثال: صفحة الشكاوى"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">رابط الصفحة</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-red-500 focus:outline-none"
                    placeholder="/complaints"
                  />
                  <select
                    onChange={e => { if (e.target.value) setLinkUrl(e.target.value) }}
                    className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="">اختر صفحة...</option>
                    <option value="/">الرئيسية</option>
                    <option value="/privacy">سياسة الخصوصية</option>
                    <option value="/disclaimer">إخلاء المسؤولية</option>
                    <option value="/complaints">الشكاوى</option>
                    <option value="/user">حسابي</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowLinkModal(false); setLinkText(''); setLinkUrl('/') }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition"
                >
                  إلغاء
                </button>
                <button
                  onClick={insertLink}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition"
                >
                  إضافة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
