'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase'

// ===================== CONFIG =====================
// Update these to match your branding and needs.
const APP_NAME = 'My App'
const APP_BADGE = 'APP' // short label shown on the avatar in the notification preview
const BRAND_COLOR = '#4f46e5' // change this one hex value to update all accent colors on the page
const BRAND_COLOR_LIGHT = '#eef2ff' // lighter tint of BRAND_COLOR, used for active/hover backgrounds

// Recipient targets. value must match the values stored in ROLE_COLUMN in the Edge Function.
// "all" always means "every user with a player_id", regardless of role.
const TARGET_OPTIONS = [
  { value: 'all', label: 'All users' },
  { value: 'customer', label: 'Customers' },
]

// Ready-to-use notification templates. Customize these for your business.
const PRESET_NOTIFS = [
  { icon: '🎉', title: 'Special promo!', message: `There's a special promo today on ${APP_NAME}. Check it out now!` },
  { icon: '🛍️', title: 'New products available', message: 'New products are now available. Check them out!' },
  { icon: '⚡', title: 'Flash sale!', message: 'Flash sale starts now! Get huge discounts today only.' },
  { icon: '🎁', title: 'A gift for you', message: `You've received a special voucher! Open the ${APP_NAME} app now.` },
  { icon: '📦', title: 'Limited stock', message: 'Some popular products are almost out of stock. Order before they run out!' },
]
// ====================================================

export default function BroadcastPage() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [target, setTarget] = useState(TARGET_OPTIONS[0].value)
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState(null) // { success, recipients, error }
  const [imageUrl, setImageUrl] = useState('')
  const [history, setHistory] = useState([])

  const handlePreset = (preset) => {
    setTitle(preset.title)
    setMessage(preset.message)
  }

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      setResult({ success: false, error: 'Title and message are required!' })
      return
    }

    setIsSending(true)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/broadcast-notification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            message: message.trim(),
            target,
            imageUrl: imageUrl.trim() || null,
          }),
        }
      )

      const data = await res.json()

      if (data.success) {
        setResult({ success: true, recipients: data.recipients, invalid: data.invalid_count })
        setHistory(prev => [{
          title: title.trim(),
          message: message.trim(),
          target,
          recipients: data.recipients,
          sentAt: new Date().toLocaleString('en-US'),
        }, ...prev.slice(0, 9)])
        setTitle('')
        setMessage('')
      } else {
        setResult({ success: false, error: data.error || 'Failed to send notification' })
      }
    } catch (e) {
      setResult({ success: false, error: e.message })
    } finally {
      setIsSending(false)
    }
  }

  const targetLabel = (value) =>
    TARGET_OPTIONS.find(opt => opt.value === value)?.label ?? value

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-800">📢 Broadcast notification</h1>
        <p className="text-gray-500 mt-1">Send a push notification to {APP_NAME} app users</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Send form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="font-bold text-gray-700 text-lg">Create notification</h2>

            {/* Target */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">Recipient target</label>
              <div className="flex gap-3">
                {TARGET_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTarget(opt.value)}
                    style={target === opt.value ? { borderColor: BRAND_COLOR, backgroundColor: BRAND_COLOR_LIGHT, color: BRAND_COLOR } : undefined}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold border-2 transition-all ${
                      target === opt.value
                        ? ''
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">Notification title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="E.g.: Year-end promo!"
                maxLength={65}
                style={{ '--tw-ring-color': BRAND_COLOR }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/65</p>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">Message body</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Write a compelling notification message..."
                maxLength={178}
                rows={4}
                style={{ '--tw-ring-color': BRAND_COLOR }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/178</p>
            </div>

            {/* Image */}
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                🖼️ Notification image <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://... (JPG/PNG image URL)"
                style={{ '--tw-ring-color': BRAND_COLOR }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              />
              {imageUrl && (
                <div className="mt-2 rounded-xl overflow-hidden border border-gray-200">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-32 object-cover"
                    onError={e => e.target.style.display = 'none'}
                  />
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">The image will appear below the notification (Android &amp; iOS)</p>
            </div>

            {/* Result */}
            {result && (
              <div className={`rounded-xl p-4 text-sm font-medium ${
                result.success
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {result.success
                  ? `✅ Notification successfully sent to ${result.recipients ?? 0} recipient(s)!`
                  : `❌ ${result.error}`
                }
              </div>
            )}

            {/* Preview */}
            {(title || message) && (
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <p className="text-xs text-gray-400 font-semibold mb-2">NOTIFICATION PREVIEW</p>
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="p-3 flex items-start gap-3">
                    <div style={{ backgroundColor: BRAND_COLOR }} className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                      {APP_BADGE}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-gray-800">{title || 'Notification title'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{message || 'Message body...'}</p>
                      <p className="text-xs text-gray-400 mt-1">Now</p>
                    </div>
                  </div>
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt="Image preview"
                      className="w-full h-28 object-cover"
                      onError={e => e.target.style.display = 'none'}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={isSending || !title.trim() || !message.trim()}
              style={!isSending && title.trim() && message.trim() ? { backgroundColor: BRAND_COLOR } : undefined}
              className="w-full disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-extrabold py-3.5 rounded-xl transition-colors text-sm hover:opacity-90"
            >
              {isSending ? '📤 Sending...' : '📢 Send notification now'}
            </button>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">

          {/* Quick templates */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-gray-700 mb-3">⚡ Quick templates</h3>
            <div className="space-y-2">
              {PRESET_NOTIFS.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => handlePreset(preset)}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = BRAND_COLOR_LIGHT
                    e.currentTarget.style.color = BRAND_COLOR
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = ''
                    e.currentTarget.style.color = ''
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-gray-600 border border-transparent transition-all"
                >
                  <span className="mr-2">{preset.icon}</span>
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <h3 className="font-bold text-amber-800 mb-2">💡 Tips</h3>
            <ul className="text-xs text-amber-700 space-y-1.5">
              <li>• Keep the title short and catchy (max 65 characters)</li>
              <li>• Make the message clear with a call-to-action</li>
              <li>• Don't send too often (max 1-2 times a day)</li>
              <li>• Use emoji to make it more engaging</li>
            </ul>
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-gray-700 text-lg mb-4">📋 Send history (this session)</h2>
          <div className="space-y-3">
            {history.map((h, i) => (
              <div key={i} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-800">{h.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{h.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{h.sentAt} · {targetLabel(h.target)}</p>
                </div>
                <span className="text-xs bg-green-100 text-green-700 font-bold px-2.5 py-1 rounded-full ml-3 flex-shrink-0">
                  {h.recipients} recipient(s)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
