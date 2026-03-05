import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [links, setLinks] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLinks()
  }, [])

  async function loadLinks() {
    const dates = {}
    
    // Only search last 30 days to avoid unnecessary 404s
    for (let i = 0; i < 30; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      try {
        const response = await fetch(`/links/${dateStr}.md`)
        if (response.ok) {
          const text = await response.text()
          const parsed = parseLinks(text, dateStr)
          if (parsed.length > 0) {
            dates[dateStr] = parsed
          }
        }
      } catch (e) {}
    }
    
    const allLinks = Object.entries(dates).flatMap(([date, links]) => 
      links.map(link => ({ ...link, date }))
    ).sort((a, b) => new Date(b.date) - new Date(a.date))
    
    setLinks(allLinks)
    setLoading(false)
  }

  function parseLinks(text, date) {
    const links = []
    const lines = text.split('\n')
    let currentLink = null
    
    for (const line of lines) {
      if (line.startsWith('- [')) {
        const match = line.match(/- \[([ x])\] \[([^\]]+)\]\(([^)]+)\)(.*)/)
        if (match) {
          if (currentLink) links.push(currentLink)
          currentLink = {
            title: match[2],
            url: match[3],
            desc: match[4].trim()
          }
        }
      } else if (line.startsWith('  - ') && currentLink) {
        currentLink.desc += ' ' + line.replace(/^  - /, '')
      }
    }
    if (currentLink) links.push(currentLink)
    
    return links
  }

  const filteredLinks = links.filter(link => {
    const q = search.toLowerCase()
    return (
      link.title.toLowerCase().includes(q) ||
      link.url.toLowerCase().includes(q) ||
      (link.desc && link.desc.toLowerCase().includes(q))
    )
  })

  return (
    <div className="app">
      <header className="header">
        <h1>Link<span>Vault</span></h1>
        <p>Your personal link collection</p>
      </header>

      <div className="search-container">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search links..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <main className="main">
        {loading ? (
          <div className="loading">Loading links...</div>
        ) : filteredLinks.length === 0 ? (
          <div className="empty">
            {search ? 'No links match your search' : 'No links saved yet. Ask Jarvis to add some!'}
          </div>
        ) : (
          <div className="links-list">
            {filteredLinks.map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="link-card"
              >
                <div className="link-info">
                  <div className="link-title">{link.title}</div>
                  <div className="link-url">{link.url}</div>
                </div>
                <div className="link-meta">
                  <span className="link-date">{link.date}</span>
                  <svg className="link-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
