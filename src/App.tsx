import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Dice6, RefreshCw, Hash, ArrowUp, ArrowDown, User, Menu, X } from 'lucide-react'

function App() {
  const [rolledNumber, setRolledNumber] = useState<number | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [discoveredCount, setDiscoveredCount] = useState(0)
  const [totalRolls, setTotalRolls] = useState(0)
  const [minNumber, setMinNumber] = useState<number | null>(null)
  const [maxNumber, setMaxNumber] = useState<number | null>(null)
  const [daysSinceStart, setDaysSinceStart] = useState(0)
  const [recentRolls, setRecentRolls] = useState<any[]>([])
  const [isNewDiscovery, setIsNewDiscovery] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [username, setUsername] = useState<string | null>(null)
  const [showUsernameInput, setShowUsernameInput] = useState(false)
  const [newUsername, setNewUsername] = useState('')

  const fetchGlobalStats = async () => {
    const [uniqueRes, totalRes, minRes, maxRes, firstRollRes] = await Promise.all([
      supabase.from('discovered_numbers').select('*', { count: 'exact' }),
      supabase.from('rolls').select('*', { count: 'exact' }),
      supabase.from('discovered_numbers').select('number').order('number', { ascending: true }).limit(1),
      supabase.from('discovered_numbers').select('number').order('number', { ascending: false }).limit(1),
      supabase.from('rolls').select('created_at').order('created_at', { ascending: true }).limit(1),
    ])

    setDiscoveredCount(uniqueRes.count || 0)
    setTotalRolls(totalRes.count || 0)
    setMinNumber(minRes.data?.[0]?.number || null)
    setMaxNumber(maxRes.data?.[0]?.number || null)

    if (firstRollRes.data?.[0]) {
      const firstDate = new Date(firstRollRes.data[0].created_at)
      const days = Math.floor((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
      setDaysSinceStart(days)
    }
  }

  const fetchRecentRolls = async () => {
    const { data } = await supabase
      .from('rolls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8)
    if (data) setRecentRolls(data)
  }

  const fetchUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    setUsername(data?.username || null)
  }

  const refreshAll = async () => {
    setIsRefreshing(true)
    await Promise.all([fetchGlobalStats(), fetchRecentRolls()])
    setTimeout(() => setIsRefreshing(false), 600)
  }

  useEffect(() => {
    fetchGlobalStats()
    fetchRecentRolls()
    fetchUserProfile()

    const channel = supabase.channel('live')
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'rolls' }, () => {
      fetchGlobalStats()
      fetchRecentRolls()
    }).subscribe()

    // Proper cleanup
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const rollDice = async () => {
    if (cooldown > 0) return

    setIsRolling(true)
    setIsNewDiscovery(false)

    try {
      const randomNumber = Math.floor(Math.random() * 1000000) + 1
      const { data, error } = await supabase.rpc('record_roll', { p_number: randomNumber })

      if (error) throw error

      if (data && data[0]) {
        const result = data[0]
        if (!result.can_roll && result.wait_seconds > 0) {
          setCooldown(result.wait_seconds)
          return
        }

        setRolledNumber(randomNumber)
        if (result.is_new) setIsNewDiscovery(true)
      }
    } catch (error) {
      alert('Roll failed. Try again.')
    } finally {
      setIsRolling(false)
    }
  }

  // 1-second cooldown
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const percentage = Math.round((discoveredCount / 1000000) * 100)

  const handleClaimUsername = async () => {
    if (!newUsername.trim() || newUsername.length < 3) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not logged in")

      const { error } = await supabase.from('profiles').upsert({ 
        id: user.id, 
        username: newUsername.trim() 
      })

      if (error) throw error

      setUsername(newUsername.trim())
      setShowUsernameInput(false)
      setNewUsername('')
      alert(`Username "${newUsername.trim()}" claimed successfully!`)
    } catch (error: any) {
      alert(error.message.includes('unique') ? "Username already taken!" : "Failed to claim username.")
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-5xl mx-auto px-5 py-10">

        {/* Top Navigation */}
        <div className="flex justify-between items-center mb-8">
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-3 hover:bg-zinc-900 rounded-xl transition-colors"
          >
            {menuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
          
          <button 
            onClick={refreshAll}
            disabled={isRefreshing}
            className="p-3 hover:bg-zinc-900 rounded-xl transition-colors"
          >
            <RefreshCw size={24} className={isRefreshing ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="text-center mb-12">
          <div className="flex justify-center items-center gap-3 mb-4">
            <div className="text-[82px] font-black tracking-[-6px] text-transparent bg-clip-text bg-gradient-to-br from-amber-300 to-yellow-500">M̅</div>
            <h1 className="text-6xl font-black tracking-tighter">ROLL</h1>
          </div>
          <p className="text-xl text-gray-400">One million numbers.<br />One shared destiny.</p>
        </div>

        {/* Progress Section */}
        <div className="bg-zinc-950 border border-amber-500/20 rounded-3xl p-8 mb-10">
          <div className="flex flex-col md:flex-row gap-8 items-center justify-between mb-8">
            <div className="flex items-center gap-5">
              <Hash className="w-10 h-10 text-amber-400" />
              <div>
                <p className="text-5xl font-mono font-bold text-white">
                  {discoveredCount.toLocaleString()} <span className="text-3xl text-gray-500">/ 1,000,000</span>
                </p>
                <p className="text-lg text-white">Unique Numbers Rolled</p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-7xl font-bold text-amber-400 tracking-tighter">{percentage}%</p>
            </div>
          </div>

          <div className="h-6 bg-zinc-900 rounded-full overflow-hidden border border-zinc-700 mb-8">
            <div className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all duration-1000" style={{ width: `${percentage}%` }} />
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-stretch justify-center mb-10">
            <button
              onClick={rollDice}
              disabled={isRolling || cooldown > 0}
              className="group px-20 py-10 bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-600 hover:brightness-110 disabled:from-zinc-700 text-black font-black text-4xl rounded-3xl flex items-center gap-5 shadow-2xl shadow-amber-600/50 active:scale-95 transition-all"
            >
              <Dice6 className="w-16 h-16 group-active:rotate-45 transition-transform" />
              {cooldown > 0 ? `WAIT ${cooldown}s` : isRolling ? "ROLLING..." : "ROLL THE DICE"}
              <RefreshCw className={`w-10 h-10 ${isRolling ? 'animate-spin' : ''}`} />
            </button>

            {rolledNumber && (
              <div className={`flex-1 max-w-md p-8 rounded-3xl border-4 flex flex-col items-center justify-center transition-all ${isNewDiscovery ? 'border-amber-400 bg-amber-400/10' : 'border-zinc-700'}`}>
                <p className="text-amber-400 tracking-[3px] text-sm mb-2">YOU ROLLED</p>
                <p className="text-6xl font-mono font-black tracking-tighter">#{rolledNumber}</p>
                {isNewDiscovery && <p className="text-xl text-amber-400 font-bold mt-4">🎉 NEW DISCOVERY!</p>}
              </div>
            )}
          </div>

          <div className="text-center">
            <p className="text-lg font-medium text-white">
              PROJECT RUNNING FOR <span className="text-amber-400 font-mono font-bold">{daysSinceStart}</span> DAYS
            </p>
          </div>
        </div>

        {/* Min/Max + Total Rolls + Username */}
        <div className="grid grid-cols-2 gap-6 text-center mb-10">
          <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-700">
            <ArrowDown className="w-7 h-7 mx-auto mb-2 text-amber-400" />
            <p className="text-xs text-gray-400">SMALLEST</p>
            <p className="text-4xl font-mono font-bold">{minNumber ? `#${minNumber}` : '—'}</p>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-700">
            <ArrowUp className="w-7 h-7 mx-auto mb-2 text-amber-400" />
            <p className="text-xs text-gray-400">LARGEST</p>
            <p className="text-4xl font-mono font-bold">{maxNumber ? `#${maxNumber}` : '—'}</p>
          </div>
        </div>

        <div className="text-center mb-12">
          <p className="text-sm text-gray-400">TOTAL ROLLS</p>
          <p className="text-4xl font-mono font-bold text-white">{totalRolls.toLocaleString()}</p>

          <div className="mt-5 flex items-center justify-center gap-3">
            <User className="w-4 h-4 text-amber-400" />
            <p className="text-base font-medium text-amber-400">
              {username ? `👤 ${username}` : "Anonymous Roller"}
            </p>
            {!username && (
              <button onClick={() => setShowUsernameInput(true)} className="text-sm px-4 py-1.5 bg-zinc-800 hover:bg-amber-400 hover:text-black border border-amber-500/30 rounded-xl transition-colors">
                Claim Username
              </button>
            )}
          </div>
        </div>

        {/* Recent Community Rolls */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
          <h2 className="text-lg font-semibold mb-5">Live Community Rolls</h2>
          <div className="space-y-3 max-h-[280px] overflow-auto">
            {recentRolls.length === 0 ? (
              <p className="text-center py-12 text-gray-500">No rolls yet. Be the first!</p>
            ) : (
              recentRolls.map((roll) => (
                <div key={roll.id} className="bg-zinc-900 px-5 py-4 rounded-2xl flex justify-between items-center hover:bg-zinc-800 transition-colors">
                  <span className="font-mono text-3xl font-bold">#{roll.rolled_number}</span>
                  <span className="text-gray-400 text-sm">
                    {new Date(roll.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Hamburger Menu */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center">
          <div className="bg-zinc-900 border border-amber-500/30 rounded-3xl p-10 max-w-md w-full mx-4 relative">
            <button 
              onClick={() => setMenuOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-white"
            >
              <X size={28} />
            </button>

            <div className="space-y-8 text-center pt-6">
              <h2 className="text-4xl font-black tracking-tighter">M̅ROLL</h2>
              
              <div className="space-y-8 text-left">
                <div>
                  <h3 className="font-semibold text-amber-400 mb-2 text-lg">THE GOAL</h3>
                  <p className="text-gray-300">Collectively roll every number from 1 to 1,000,000.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-amber-400 mb-2 text-lg">HOW TO PLAY</h3>
                  <p className="text-gray-300">Hit the big button. Get random numbers. Help the community reach the goal.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-amber-400 mb-2 text-lg">ABOUT</h3>
                  <p className="text-gray-300">A fun community experiment built with React + Supabase.</p>
                  <p className="text-gray-400 mt-3">
                    Follow development:{' '}
                    <a href="https://x.com/MROLLGAME" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                      @MROLLGAME
                    </a>
                  </p>
                </div>
              </div>

              <button onClick={() => setMenuOpen(false)} className="w-full py-4 bg-amber-400 text-black font-bold rounded-2xl text-lg">
                Back to Rolling
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Username Modal */}
      {showUsernameInput && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-amber-500/50 rounded-3xl p-8 w-full max-w-md mx-4">
            <h3 className="text-2xl font-bold mb-6 text-center">Claim Your Username</h3>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="e.g. MRollFan"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-4 text-lg mb-8 focus:outline-none focus:border-amber-400"
            />
            <div className="flex gap-4">
              <button onClick={() => { setShowUsernameInput(false); setNewUsername(''); }} className="flex-1 py-4 rounded-2xl border border-zinc-700 hover:bg-zinc-800">
                Cancel
              </button>
              <button onClick={handleClaimUsername} disabled={!newUsername.trim() || newUsername.length < 3} className="flex-1 py-4 rounded-2xl bg-amber-400 text-black font-bold disabled:opacity-50">
                Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App