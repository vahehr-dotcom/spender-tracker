import React, { useState, useRef, useEffect } from 'react'

export default function CategoryPicker({ categories, mainCategories = [], value, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedGroups, setExpandedGroups] = useState({})
  const containerRef = useRef(null)
  const searchRef = useRef(null)

  const selectedCategory = categories.find(c => c.id === value)
  const hasGrouped = mainCategories && mainCategories.length > 0

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus()
    }
  }, [isOpen])

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const handleSelect = (id) => {
    onChange(id)
    setIsOpen(false)
    setSearch('')
  }

  const filteredGroups = hasGrouped
    ? mainCategories.map(main => {
        const lower = search.toLowerCase()
        const mainMatch = main.name.toLowerCase().includes(lower)
        const matchingSubs = (main.subcategories || []).filter(sub =>
          sub.name.toLowerCase().includes(lower)
        )
        if (!search) return { ...main, filteredSubs: main.subcategories || [] }
        if (mainMatch) return { ...main, filteredSubs: main.subcategories || [] }
        if (matchingSubs.length > 0) return { ...main, filteredSubs: matchingSubs }
        return null
      }).filter(Boolean)
    : []

  const flatFiltered = !hasGrouped
    ? categories.filter(c => c.parent_id === null && c.name.toLowerCase().includes(search.toLowerCase()))
    : []

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '16px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          boxSizing: 'border-box',
          cursor: 'pointer',
          background: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: '42px'
        }}
      >
        <span style={{ color: selectedCategory ? '#111' : '#999' }}>
          {selectedCategory ? selectedCategory.name : '-- Select Category --'}
        </span>
        <span style={{ fontSize: '12px', color: '#999' }}>{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 100,
          maxHeight: '300px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories..."
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ overflowY: 'auto', maxHeight: '250px' }}>
            {hasGrouped ? (
              filteredGroups.length > 0 ? (
                filteredGroups.map(main => {
                  const isExpanded = expandedGroups[main.id] || search.length > 0
                  return (
                    <div key={main.id}>
                      <div
                        onClick={() => search ? null : toggleGroup(main.id)}
                        style={{
                          padding: '8px 12px',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          background: '#f7f7f7',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: '1px solid #eee',
                          userSelect: 'none'
                        }}
                      >
                        <span>{main.name}</span>
                        <span style={{ fontSize: '11px', color: '#999' }}>
                          {isExpanded ? '−' : `+ ${(main.filteredSubs || []).length}`}
                        </span>
                      </div>

                      {isExpanded && (
                        <>
                          <div
                            onClick={() => handleSelect(main.id)}
                            style={{
                              padding: '7px 12px 7px 24px',
                              fontSize: '14px',
                              cursor: 'pointer',
                              background: value === main.id ? '#eef2ff' : 'white',
                              borderBottom: '1px solid #f5f5f5'
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#f0f0f0'}
                            onMouseLeave={(e) => e.target.style.background = value === main.id ? '#eef2ff' : 'white'}
                          >
                            {main.name} (General)
                          </div>
                          {(main.filteredSubs || []).map(sub => (
                            <div
                              key={sub.id}
                              onClick={() => handleSelect(sub.id)}
                              style={{
                                padding: '7px 12px 7px 36px',
                                fontSize: '14px',
                                cursor: 'pointer',
                                background: value === sub.id ? '#eef2ff' : 'white',
                                borderBottom: '1px solid #f5f5f5'
                              }}
                              onMouseEnter={(e) => e.target.style.background = '#f0f0f0'}
                              onMouseLeave={(e) => e.target.style.background = value === sub.id ? '#eef2ff' : 'white'}
                            >
                              {sub.name}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )
                })
              ) : (
                <div style={{ padding: '12px', color: '#999', textAlign: 'center', fontSize: '14px' }}>
                  No categories found
                </div>
              )
            ) : (
              flatFiltered.length > 0 ? (
                flatFiltered.map(cat => (
                  <div
                    key={cat.id}
                    onClick={() => handleSelect(cat.id)}
                    style={{
                      padding: '8px 12px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      background: value === cat.id ? '#eef2ff' : 'white',
                      borderBottom: '1px solid #f5f5f5'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#f0f0f0'}
                    onMouseLeave={(e) => e.target.style.background = value === cat.id ? '#eef2ff' : 'white'}
                  >
                    {cat.name}
                  </div>
                ))
              ) : (
                <div style={{ padding: '12px', color: '#999', textAlign: 'center', fontSize: '14px' }}>
                  No categories found
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}