import { useState, useEffect, useMemo } from 'react'
import './App.css'

function App() {
  const [links, setLinks] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedStats, setExpandedStats] = useState(false)

  useEffect(() => {
    loadLinks()
  }, [])

  // Calculate stats from links
  const stats = useMemo(() => {
    const totalLinks = links.length
    const uniqueDates = new Set(links.map(l => l.date)).size
    const avgPerDay = uniqueDates > 0 ? (totalLinks / uniqueDates).toFixed(1) : 0
    
    // Links by date (last 14 days)
    const linksByDate = links.reduce((acc, link) => {
      acc[link.date] = (acc[link.date] || 0) + 1
      return acc
    }, {})
    
    // Get last 14 days sorted
    const sortedDates = Object.keys(linksByDate)
      .sort((a, b) => new Date(b) - new Date(a))
      .slice(0, 14)
    
    // Calculate avg excluding empty days
    const counts = Object.values(linksByDate)
    const avgCount = counts.length > 0 
      ? (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)
      : 0
    
    // Find outliers (>2x avg or <0.5x avg)
    const outliers = sortedDates.filter(date => {
      const count = linksByDate[date]
      return count > avgCount * 2 || count < avgCount * 0.5
    })
    
    return {
      totalLinks,
      uniqueDates,
      avgPerDay,
      linksByDate,
      sortedDates,
      avgCount,
      outliers
    }
  }, [links])

  async function loadLinks() {
    try {
      const response = await fetch('/links/manifest.json')
      if (response.ok) {
        const files = await response.json()
        await loadFromFiles(files)
        return
      }
    } catch (e) {}
    await loadFromDates()
  }

  async function loadFromFiles(files) {
    // Fetch all files in parallel for much faster loading
    const filePromises = files.map(async (file) => {
      try {
        const response = await fetch(`/links/${file}`)
        if (response.ok) {
          const text = await response.text()
          const date = file.replace('.md', '')
          const parsed = parseMarkdownLinks(text, date)
          return parsed.map(link => ({ ...link, date }))
        }
      } catch (e) {}
      return []
    })
    
    const results = await Promise.all(filePromises)
    const allLinks = results.flat()
    
    setLinks(allLinks.sort((a, b) => new Date(b.date) - new Date(a.date)))
    setLoading(false)
  }

  async function loadFromDates() {
    const allLinks = []
    
    for (let i = 0; i < 30; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      try {
        const response = await fetch(`/links/${dateStr}.md`)
        if (response.ok) {
          const text = await response.text()
          const parsed = parseMarkdownLinks(text, dateStr)
          allLinks.push(...parsed.map(link => ({ ...link, date: dateStr })))
        }
      } catch (e) {}
    }
    
    setLinks(allLinks.sort((a, b) => new Date(b.date) - new Date(a.date)))
    setLoading(false)
  }

  function parseMarkdownLinks(text, date) {
    const links = []
    const lines = text.split('\n')
    
    for (const line of lines) {
      // Parse checkbox format: - [ ] [Title](URL) - Description
      // or: - [x] [Title](URL) - Description
      const checkboxMatch = line.match(/^-\s*\[[\sx]\]\s*\[([^\]]+)\]\(([^)]+)\)(?:\s+-\s+(.+))?$/i)
      if (checkboxMatch) {
        links.push({
          title: checkboxMatch[1].trim(),
          url: checkboxMatch[2].trim(),
          desc: checkboxMatch[3] ? checkboxMatch[3].trim() : '',
          date: date
        })
        continue
      }
      
      // Also support plain markdown links: [Title](URL)
      const plainMatch = line.match(/^-\s*\[([^\]]+)\]\(([^)]+)\)(?:\s+-\s+(.+))?$/i)
      if (plainMatch) {
        links.push({
          title: plainMatch[1].trim(),
          url: plainMatch[2].trim(),
          desc: plainMatch[3] ? plainMatch[3].trim() : '',
          date: date
        })
        continue
      }
      
      // Legacy format support (for backwards compatibility)
      const legacyMatch = line.match(/^-\s*\[?\s*\]?\s*\[([^\]]+)\]\(([^)]+)\)(?:\s+-\s+(.+))?$/i)
      if (legacyMatch) {
        links.push({
          title: legacyMatch[1].trim(),
          url: legacyMatch[2].trim(),
          desc: legacyMatch[3] ? legacyMatch[3].trim() : '',
          date: date
        })
      }
    }
    
    return links
  }

  const filteredLinks = links.filter(link => {
    const q = search.toLowerCase()
    return (
      link.title?.toLowerCase().includes(q) ||
      link.url?.toLowerCase().includes(q) ||
      (link.desc && link.desc.toLowerCase().includes(q)) ||
      (link.topic && link.topic.toLowerCase().includes(q))
    )
  })

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    })
  }

  const isToday = (dateStr) => {
    const today = new Date().toISOString().split('T')[0]
    return dateStr === today
  }

  const isYesterday = (dateStr) => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return dateStr === yesterday.toISOString().split('T')[0]
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Link<span>Vault</span></h1>
        <p>Your personal link collection</p>
      </header>

      {/* Stats Widget */}
      {!loading && links.length > 0 && (
        <div className="stats-widget">
          <div className="stats-header" onClick={() => setExpandedStats(!expandedStats)}>
            <div className="stats-summary">
              <div className="stat-item total">
                <span className="stat-value">{stats.totalLinks}</span>
                <span className="stat-label">Total Links</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.uniqueDates}</span>
                <span className="stat-label">Days with Links</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.avgPerDay}</span>
                <span className="stat-label">Avg/Day</span>
              </div>
              {stats.outliers.length > 0 && (
                <div className="stat-item warning">
                  <span className="stat-value">{stats.outliers.length}</span>
                  <span className="stat-label">Unusual Days</span>
                </div>
              )}
            </div>
            <button className="stats-toggle">
              {expandedStats ? '▼' : '▶'}
            </button>
          </div>

          {expandedStats && (
            <div className="stats-detail">
              <p className="stats-info">
                Daily breakdown (last 14 days with links). 
                <span className="outlier-hint">Yellow = 2x above avg, Red = below 50% of avg</span>
              </p>
              <div className="daily-breakdown">
                {stats.sortedDates.map(date => {
                  const count = stats.linksByDate[date]
                  const isHigh = count > stats.avgCount * 2
                  const isLow = count < stats.avgCount * 0.5
                  const dayLabel = isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : formatDate(date)
                  
                  return (
                    <div 
                      key={date} 
                      className={`day-stat ${isHigh ? 'high' : ''} ${isLow ? 'low' : ''}`}
                    >
                      <div className="day-info">
                        <span className="day-date">{dayLabel}</span>
                        <span className="day-count">{count} links</span>
                      </div>
                      <div className="day-bar-container">
                        <div 
                          className="day-bar"
                          style={{ 
                            width: `${Math.min((count / (stats.avgCount * 3)) * 100, 100)}%`,
                            backgroundColor: isHigh ? '#f59e0b' : isLow ? '#ef4444' : '#00d992'
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

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
                  {link.desc && (
                    <div className="link-desc">{link.desc.substring(0, 120)}...</div>
                  )}
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
