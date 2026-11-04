import React from 'react'

export default function AnnouncementBar({ content }) {
  if (!content?.text) return null
  return (
    <div className="ls-announcement" data-purpose="announcement-bar">
      {content.text}
      {content.link_text && content.link_href && <a className="ml-3 underline underline-offset-2" href={content.link_href}>{content.link_text}</a>}
    </div>
  )
}