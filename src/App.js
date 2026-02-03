 1	import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
     2	import { supabase } from './supabaseClient'
     3	
     4	import Login from './components/Login'
     5	import ChatAssistant from './components/ChatAssistant'
     6	import AddExpenseForm from './components/AddExpenseForm'
     7	import ExpenseList from './components/ExpenseList'
     8	import MonthlySummary from './components/MonthlySummary'
     9	import FileImport from './components/FileImport'
    10	import ImportPreview from './components/ImportPreview'
    11	import AnalyticsDashboard from './components/AnalyticsDashboard'
    12	
    13	import ProactiveEngine from './lib/ProactiveEngine'
    14	import PatternAnalyzer from './lib/PatternAnalyzer'
    15	import PredictiveEngine from './lib/PredictiveEngine'
    16	
    17	// Helper: current local datetime string for default spentAt
    18	function getNowLocalDateTime() {
    19	  const now = new Date()
    20	  const offset = now.getTimezoneOffset() * 60000
    21	  const local = new Date(now.getTime() - offset)
    22	  return local.toISOString().slice(0, 16)
    23	}
    24	
    25	function App() {
    26	  // Auth & subscription state
    27	  const [session, setSession] = useState(null)
    28	  const [subscriptionStatus, setSubscriptionStatus] = useState('free') // 'free' or 'pro'
    29	  const [testMode, setTestMode] = useState(false) // Admin testing toggle
    30	  const [showPaywall, setShowPaywall] = useState(false)
    31	
    32	  // User profile & role
    33	  const [userRole, setUserRole] = useState(null)
    34	  const [userName, setUserName] = useState('')
    35	  const [userTitle, setUserTitle] = useState('')
    36	
    37	  // UI toggles for admin
    38	  const [showLoginHistory, setShowLoginHistory] = useState(false)
    39	  const [showAnalytics, setShowAnalytics] = useState(false)
    40	
    41	  // Categories
    42	  const [categories, setCategories] = useState([])
    43	
    44	  // Expenses
    45	  const [expenses, setExpenses] = useState([])
    46	  const [allExpenses, setAllExpenses] = useState([])
    47	
    48	  // Add expense form
    49	  const [amount, setAmount] = useState('')
    50	  const [merchant, setMerchant] = useState('')
    51	  const [categoryId, setCategoryId] = useState('')
    52	  const [paymentMethod, setPaymentMethod] = useState('card')
    53	  const [spentAtLocal, setSpentAtLocal] = useState(getNowLocalDateTime())
    54	  const [status, setStatus] = useState('cleared')
    55	  const [isSaving, setIsSaving] = useState(false)
    56	  const [saveSuccess, setSaveSuccess] = useState(false)
    57	
    58	  // More options
    59	  const [showMoreOptions, setShowMoreOptions] = useState(false)
    60	  const [isTaxDeductible, setIsTaxDeductible] = useState(false)
    61	  const [notes, setNotes] = useState('')
    62	  const [isReimbursable, setIsReimbursable] = useState(false)
    63	  const [employerOrClient, setEmployerOrClient] = useState('')
    64	  const [tagsText, setTagsText] = useState('')
    65	
    66	  // Budgets
    67	  const [budgets, setBudgets] = useState([])
    68	  const [showBudgetPanel, setShowBudgetPanel] = useState(false)
    69	
    70	  // AI insights (Pro feature)
    71	  const [aiInsights, setAiInsights] = useState(null)
    72	
    73	  // Receipt upload
    74	  const [receiptFile, setReceiptFile] = useState(null)
    75	  const [receiptUrls, setReceiptUrls] = useState([])
    76	  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false)
    77	
    78	  // Archive & search
    79	  const [showArchived, setShowArchived] = useState(false)
    80	  const [search, setSearch] = useState('')
    81	
    82	  // Undo banner (for archive undo)
    83	  const [undoBanner, setUndoBanner] = useState(null)
    84	
    85	  // Import
    86	  const [showImport, setShowImport] = useState(false)
    87	  const [importedTransactions, setImportedTransactions] = useState([])
    88	
    89	  // Notifications (Pro feature)
    90	  const [notifications, setNotifications] = useState([])
    91	
    92	  // Session tracking
    93	  const sessionIdRef = useRef(null)
    94	  const lastActivityRef = useRef(Date.now())
    95	  const pageStartRef = useRef(Date.now())
    96	
    97	  // Merchant memory for category suggestions
    98	  const merchantMemoryRef = useRef(new Map())
    99	
   100	  // Derive Pro mode flag
   101	  const isProMode = !testMode && subscriptionStatus === 'pro'
   102	
   103	  // Derive admin flag
   104	  const isAdmin = userRole === 'admin'
   105	
   106	  // ---------------------------------------------------------------------------
   107	  // Session & auth setup
   108	  // ---------------------------------------------------------------------------
   109	  useEffect(() => {
   110	    supabase.auth.getSession().then(({ data: { session } }) => {
   111	      setSession(session)
   112	    })
   113	
   114	    const {
   115	      data: { subscription },
   116	    } = supabase.auth.onAuthStateChange((_event, session) => {
   117	      setSession(session)
   118	    })
   119	
   120	    return () => subscription.unsubscribe()
   121	  }, [])
   122	
   123	  // Track session start/continue and last_activity
   124	  useEffect(() => {
   125	    if (!session?.user) return
   126	
   127	    const userId = session.user.id
   128	
   129	    async function startOrContinueSession() {
   130	      try {
   131	        // Check for an active session in last 30 minutes
   132	        const { data: existing } = await supabase
   133	          .from('user_sessions')
   134	          .select('id')
   135	          .eq('user_id', userId)
   136	          .is('session_end', null)
   137	          .order('session_start', { ascending: false })
   138	          .limit(1)
   139	          .maybeSingle()
   140	
   141	        if (existing) {
   142	          sessionIdRef.current = existing.id
   143	          console.log('[App] Continuing session:', existing.id)
   144	        } else {
   145	          // Create new session
   146	          const { data: newSession } = await supabase
   147	            .from('user_sessions')
   148	            .insert({
   149	              user_id: userId,
   150	              session_start: new Date().toISOString(),
   151	            })
   152	            .select()
   153	            .single()
   154	
   155	          if (newSession) {
   156	            sessionIdRef.current = newSession.id
   157	            console.log('[App] New session started:', newSession.id)
   158	          }
   159	        }
   160	      } catch (err) {
   161	        console.error('[App] startOrContinueSession error:', err)
   162	      }
   163	    }
   164	
   165	    startOrContinueSession()
   166	
   167	    // Track last_activity every 30s
   168	    const activityInterval = setInterval(async () => {
   169	      if (sessionIdRef.current) {
   170	        lastActivityRef.current = Date.now()
   171	        await supabase
   172	          .from('user_sessions')
   173	          .update({ last_activity: new Date().toISOString() })
   174	          .eq('id', sessionIdRef.current)
   175	      }
   176	    }, 30000)
   177	
   178	    // On unload, finalize session
   179	    const handleUnload = async () => {
   180	      if (sessionIdRef.current) {
   181	        const start = pageStartRef.current
   182	        const end = Date.now()
   183	        const duration = Math.floor((end - start) / 1000)
   184	        await supabase
   185	          .from('user_sessions')
   186	          .update({
   187	            session_end: new Date().toISOString(),
   188	            duration_seconds: duration,
   189	          })
   190	          .eq('id', sessionIdRef.current)
   191	      }
   192	    }
   193	
   194	    window.addEventListener('beforeunload', handleUnload)
   195	    return () => {
   196	      window.removeEventListener('beforeunload', handleUnload)
   197	      clearInterval(activityInterval)
   198	    }
   199	  }, [session])
   200	
   201	  // Track login event
   202	  useEffect(() => {
   203	    if (!session?.user) return
   204	
   205	    async function trackLogin() {
   206	      try {
   207	        await supabase.from('login_logs').insert({
   208	          user_id: session.user.id,
   209	          email: session.user.email,
   210	        })
   211	        console.log('[App] Login tracked:', session.user.email)
   212	      } catch (err) {
   213	        console.error('[App] trackLogin error:', err)
   214	      }
   215	    }
   216	
   217	    trackLogin()
   218	  }, [session])
   219	
   220	  // Track page views
   221	  const trackPageView = useCallback(
   222	    async (pageName) => {
   223	      if (!session?.user || !sessionIdRef.current) return
   224	
   225	      try {
   226	        await supabase.from('page_views').insert({
   227	          user_id: session.user.id,
   228	          session_id: sessionIdRef.current,
   229	          page_name: pageName,
   230	          page_url: window.location.href,
   231	          device_info: navigator.userAgent,
   232	        })
   233	        console.log('[App] Page view tracked:', pageName)
   234	      } catch (err) {
   235	        console.error('[App] trackPageView error:', err)
   236	      }
   237	    },
   238	    [session]
   239	  )
   240	
   241	  useEffect(() => {
   242	    if (session?.user) {
   243	      trackPageView('Dashboard')
   244	    }
   245	  }, [session, trackPageView])
   246	
   247	  // ---------------------------------------------------------------------------
   248	  // Load user role, profile, subscription
   249	  // ---------------------------------------------------------------------------
   250	  const loadUserRole = useCallback(async (userId) => {
   251	    try {
   252	      const { data } = await supabase
   253	        .from('user_preferences')
   254	        .select('role')
   255	        .eq('id', userId)
   256	        .maybeSingle()
   257	
   258	      if (data?.role) {
   259	        setUserRole(data.role)
   260	      }
   261	    } catch (err) {
   262	      console.error('[App] loadUserRole error:', err)
   263	    }
   264	  }, [])
   265	
   266	  const loadUserProfile = useCallback(async (userId) => {
   267	    try {
   268	      const { data } = await supabase
   269	        .from('user_preferences')
   270	        .select('display_name, title')
   271	        .eq('id', userId)
   272	        .maybeSingle()
   273	
   274	      if (data) {
   275	        setUserName(data.display_name || '')
   276	        setUserTitle(data.title || '')
   277	      }
   278	    } catch (err) {
   279	      console.error('[App] loadUserProfile error:', err)
   280	    }
   281	  }, [])
   282	
   283	  const loadSubscription = useCallback(async (userId) => {
   284	    try {
   285	      const { data } = await supabase
   286	        .from('subscriptions')
   287	        .select('status')
   288	        .eq('user_id', userId)
   289	        .maybeSingle()
   290	
   291	      // Auto-PRO for CEO and testers
   292	      const ceoEmail = 'lifeliftusa@gmail.com'
   293	      const testEmails = ['tester1@example.com', 'tester2@example.com']
   294	      const userEmail = session?.user?.email
   295	
   296	      if (userEmail === ceoEmail || testEmails.includes(userEmail)) {
   297	        setSubscriptionStatus('pro')
   298	      } else if (data?.status === 'pro') {
   299	        setSubscriptionStatus('pro')
   300	      } else {
   301	        setSubscriptionStatus('free')
   302	      }
   303	    } catch (err) {
   304	      console.error('[App] loadSubscription error:', err)
   305	      setSubscriptionStatus('free')
   306	    }
   307	  }, [session])
   308	
   309	  useEffect(() => {
   310	    if (session?.user) {
   311	      loadUserRole(session.user.id)
   312	      loadUserProfile(session.user.id)
   313	      loadSubscription(session.user.id)
   314	    }
   315	  }, [session, loadUserRole, loadUserProfile, loadSubscription])
   316	
   317	  // ---------------------------------------------------------------------------
   318	  // Load categories
   319	  // ---------------------------------------------------------------------------
   320	  const loadCategories = useCallback(async (userId) => {
   321	    try {
   322	      const { data } = await supabase
   323	        .from('categories')
   324	        .select('id, name, icon, color')
   325	        .eq('user_id', userId)
   326	        .order('name')
   327	
   328	      if (data) {
   329	        setCategories(data)
   330	      }
   331	    } catch (err) {
   332	      console.error('[App] loadCategories error:', err)
   333	    }
   334	  }, [])
   335	
   336	  useEffect(() => {
   337	    if (session?.user) {
   338	      loadCategories(session.user.id)
   339	    }
   340	  }, [session, loadCategories])
   341	
   342	  // ---------------------------------------------------------------------------
   343	  // Load expenses
   344	  // ---------------------------------------------------------------------------
   345	  const loadExpenses = useCallback(
   346	    async (userId) => {
   347	      try {
   348	        const { data: allData } = await supabase
   349	          .from('expenses')
   350	          .select('*')
   351	          .eq('user_id', userId)
   352	          .order('spent_at', { ascending: false })
   353	
   354	        if (allData) {
   355	          setAllExpenses(allData)
   356	
   357	          // Build merchant memory for category suggestions
   358	          const map = new Map()
   359	          allData.forEach((exp) => {
   360	            if (exp.merchant && exp.category_id) {
   361	              map.set(exp.merchant.toLowerCase(), exp.category_id)
   362	            }
   363	          })
   364	          merchantMemoryRef.current = map
   365	
   366	          // Filter for current view
   367	          let filtered = allData.filter((e) => {
   368	            if (showArchived && !e.archived) return false
   369	            if (!showArchived && e.archived) return false
   370	            return true
   371	          })
   372	
   373	          if (search) {
   374	            const lowerSearch = search.toLowerCase()
   375	            filtered = filtered.filter(
   376	              (e) =>
   377	                e.merchant?.toLowerCase().includes(lowerSearch) ||
   378	                e.notes?.toLowerCase().includes(lowerSearch)
   379	            )
   380	          }
   381	
   382	          setExpenses(filtered)
   383	        }
   384	      } catch (err) {
   385	        console.error('[App] loadExpenses error:', err)
   386	      }
   387	    },
   388	    [showArchived, search]
   389	  )
   390	
   391	  useEffect(() => {
   392	    if (session?.user) {
   393	      loadExpenses(session.user.id)
   394	    }
   395	  }, [session, showArchived, search, loadExpenses])
   396	
   397	  // ---------------------------------------------------------------------------
   398	  // AI Insights (Pro feature)
   399	  // ---------------------------------------------------------------------------
   400	  const calculateAIInsights = useCallback(() => {
   401	    if (!isProMode || allExpenses.length === 0) {
   402	      setAiInsights(null)
   403	      return
   404	    }
   405	
   406	    try {
   407	      const now = new Date()
   408	      const currentMonth = now.getMonth()
   409	      const currentYear = now.getFullYear()
   410	
   411	      const thisMonthExpenses = allExpenses.filter((e) => {
   412	        if (e.archived) return false
   413	        const d = new Date(e.spent_at)
   414	        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
   415	      })
   416	
   417	      // Forecast: sum of this month's expenses
   418	      const forecastTotal = thisMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
   419	
   420	      // Recurring expenses: merchants appearing 2+ times this month
   421	      const merchantCounts = {}
   422	      thisMonthExpenses.forEach((e) => {
   423	        const m = e.merchant || 'Unknown'
   424	        merchantCounts[m] = (merchantCounts[m] || 0) + 1
   425	      })
   426	      const recurringExpenses = Object.keys(merchantCounts).filter(
   427	        (m) => merchantCounts[m] >= 2
   428	      )
   429	
   430	      // Top categories by spending
   431	      const categorySpending = {}
   432	      thisMonthExpenses.forEach((e) => {
   433	        const cat = categories.find((c) => c.id === e.category_id)
   434	        const name = cat?.name || 'Unknown'
   435	        categorySpending[name] = (categorySpending[name] || 0) + (e.amount || 0)
   436	      })
   437	      const sorted = Object.entries(categorySpending)
   438	        .sort((a, b) => b[1] - a[1])
   439	        .slice(0, 5)
   440	        .map(([name, spent]) => ({ name, spent }))
   441	
   442	      setAiInsights({
   443	        forecastTotal,
   444	        recurringExpenses,
   445	        categorySpending: sorted,
   446	      })
   447	    } catch (err) {
   448	      console.error('[App] calculateAIInsights error:', err)
   449	    }
   450	  }, [isProMode, allExpenses, categories])
   451	
   452	  useEffect(() => {
   453	    if (isProMode && allExpenses.length > 0 && categories.length > 0) {
   454	      calculateAIInsights()
   455	    }
   456	  }, [isProMode, allExpenses, categories, calculateAIInsights])
   457	
   458	  // ---------------------------------------------------------------------------
   459	  // AI command handler (Nova)
   460	  // ---------------------------------------------------------------------------
   461	  const handleAICommand = useCallback(
   462	    async (command) => {
   463	      console.log('[App] AI command received:', command)
   464	
   465	      if (command.action === 'add_expense') {
   466	        const { merchant: m, amount: a, category: c, date_hint } = command
   467	
   468	        // Validate amount
   469	        if (!a || isNaN(a) || a <= 0) {
   470	          console.warn('[App] Invalid amount:', a)
   471	          return
   472	        }
   473	
   474	        // Resolve category
   475	        let resolvedCategoryId = categoryId
   476	        if (c) {
   477	          const found = categories.find(
   478	            (cat) => cat.name.toLowerCase() === c.toLowerCase()
   479	          )
   480	          if (found) {
   481	            resolvedCategoryId = found.id
   482	          }
   483	        }
   484	
   485	        // Resolve date
   486	        let resolvedDate = spentAtLocal
   487	        if (date_hint) {
   488	          const parsed = parseNaturalDate(date_hint)
   489	          if (parsed) {
   490	            resolvedDate = parsed
   491	          }
   492	        }
   493	
   494	        // Set form
   495	        setMerchant(m || '')
   496	        setAmount(String(a))
   497	        setCategoryId(resolvedCategoryId)
   498	        setSpentAtLocal(resolvedDate)
   499	
   500	        // Auto-submit
   501	        setTimeout(() => {
   502	          const btn = document.querySelector('button[type="submit"]')
   503	          if (btn) btn.click()
   504	        }, 100)
   505	
   506	        return
   507	      }
   508	
   509	      if (command.action === 'update_expense') {
   510	        const { target, updates } = command
   511	        let expenseToUpdate = null
   512	
   513	        if (target?.id) {
   514	          expenseToUpdate = expenses.find((e) => e.id === target.id)
   515	        } else if (target?.merchant) {
   516	          expenseToUpdate = expenses.find(
   517	            (e) => e.merchant?.toLowerCase() === target.merchant.toLowerCase()
   518	          )
   519	        }
   520	
   521	        if (expenseToUpdate && updates) {
   522	          await updateExpense(expenseToUpdate.id, updates)
   523	          await loadExpenses(session.user.id)
   524	        }
   525	
   526	        return
   527	      }
   528	
   529	      if (command.action === 'search') {
   530	        setSearch(command.query || '')
   531	        return
   532	      }
   533	
   534	      if (command.action === 'export') {
   535	        exportCsv()
   536	        return
   537	      }
   538	    },
   539	    [
   540	      categoryId,
   541	      spentAtLocal,
   542	      categories,
   543	      expenses,
   544	      session,
   545	      loadExpenses,
   546	    ]
   547	  )
   548	
   549	  // ---------------------------------------------------------------------------
   550	  // Helper: parse natural date strings
   551	  // ---------------------------------------------------------------------------
   552	  function parseNaturalDate(hint) {
   553	    const lower = hint.toLowerCase()
   554	    const now = new Date()
   555	
   556	    if (lower.includes('yesterday')) {
   557	      const d = new Date(now)
   558	      d.setDate(d.getDate() - 1)
   559	      return d.toISOString().slice(0, 16)
   560	    }
   561	
   562	    const daysAgoMatch = lower.match(/(\d+)\s*days?\s*ago/)
   563	    if (daysAgoMatch) {
   564	      const days = parseInt(daysAgoMatch[1], 10)
   565	      const d = new Date(now)
   566	      d.setDate(d.getDate() - days)
   567	      return d.toISOString().slice(0, 16)
   568	    }
   569	
   570	    if (lower.includes('last week')) {
   571	      const d = new Date(now)
   572	      d.setDate(d.getDate() - 7)
   573	      return d.toISOString().slice(0, 16)
   574	    }
   575	
   576	    return null
   577	  }
   578	
   579	  // ---------------------------------------------------------------------------
   580	  // Category suggestion using merchant memory + OpenAI fallback
   581	  // ---------------------------------------------------------------------------
   582	  const suggestCategoryForMerchant = useCallback(
   583	    async (merchantName) => {
   584	      if (!merchantName) return categoryId
   585	
   586	      const lowerMerchant = merchantName.toLowerCase()
   587	
   588	      // Check memory first
   589	      if (merchantMemoryRef.current.has(lowerMerchant)) {
   590	        return merchantMemoryRef.current.get(lowerMerchant)
   591	      }
   592	
   593	      // Fallback to OpenAI
   594	      try {
   595	        const apiKey = process.env.REACT_APP_OPENAI_API_KEY
   596	        if (!apiKey) {
   597	          console.warn('[App] No OpenAI API key found')
   598	          return categories[0]?.id || ''
   599	        }
   600	
   601	        const categoryNames = categories.map((c) => c.name).join(', ')
   602	        const prompt = `You are a helpful assistant. Given the merchant name "${merchantName}", suggest the most appropriate category from this list: ${categoryNames}. Respond with only the category name.`
   603	
   604	        const res = await fetch('https://api.openai.com/v1/chat/completions', {
   605	          method: 'POST',
   606	          headers: {
   607	            'Content-Type': 'application/json',
   608	            Authorization: `Bearer ${apiKey}`,
   609	          },
   610	          body: JSON.stringify({
   611	            model: 'gpt-4o',
   612	            messages: [{ role: 'user', content: prompt }],
   613	            max_tokens: 50,
   614	          }),
   615	        })
   616	
   617	        const json = await res.json()
   618	        const suggested = json.choices?.[0]?.message?.content?.trim()
   619	
   620	        if (suggested) {
   621	          const found = categories.find(
   622	            (c) => c.name.toLowerCase() === suggested.toLowerCase()
   623	          )
   624	          if (found) {
   625	            merchantMemoryRef.current.set(lowerMerchant, found.id)
   626	            return found.id
   627	          }
   628	        }
   629	
   630	        return categories[0]?.id || ''
   631	      } catch (err) {
   632	        console.error('[App] suggestCategoryForMerchant error:', err)
   633	        return categories[0]?.id || ''
   634	      }
   635	    },
   636	    [categoryId, categories]
   637	  )
   638	
   639	  // ---------------------------------------------------------------------------
   640	  // Receipt OCR processing with OpenAI
   641	  // ---------------------------------------------------------------------------
   642	  const processReceiptWithOCR = useCallback(
   643	    async (file) => {
   644	      if (!file) return
   645	
   646	      setIsProcessingReceipt(true)
   647	
   648	      try {
   649	        const userId = session?.user?.id
   650	        if (!userId) throw new Error('No user ID')
   651	
   652	        // Upload to storage
   653	        const sanitized = sanitizeFilename(file.name)
   654	        const filePath = `${userId}/${Date.now()}_${sanitized}`
   655	        const { error: uploadError } = await supabase.storage
   656	          .from('receipts')
   657	          .upload(filePath, file)
   658	
   659	        if (uploadError) throw uploadError
   660	
   661	        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filePath)
   662	        const publicUrl = urlData?.publicUrl || ''
   663	
   664	        if (publicUrl) {
   665	          setReceiptUrls((prev) => [...prev, publicUrl])
   666	        }
   667	
   668	        // Convert to base64 for OpenAI
   669	        const base64 = await fileToBase64(file)
   670	
   671	        // Call OpenAI Vision
   672	        const apiKey = process.env.REACT_APP_OPENAI_API_KEY
   673	        if (!apiKey) throw new Error('No OpenAI API key')
   674	
   675	        const prompt = `Extract the following information from this receipt image in JSON format:
   676	{
   677	  "merchant": "name of merchant",
   678	  "amount": <total amount as number>,
   679	  "date": "YYYY-MM-DD",
   680	  "items": ["item1", "item2"]
   681	}
   682	If any field is missing, use null.`
   683	
   684	        const res = await fetch('https://api.openai.com/v1/chat/completions', {
   685	          method: 'POST',
   686	          headers: {
   687	            'Content-Type': 'application/json',
   688	            Authorization: `Bearer ${apiKey}`,
   689	          },
   690	          body: JSON.stringify({
   691	            model: 'gpt-4o',
   692	            messages: [
   693	              {
   694	                role: 'user',
   695	                content: [
   696	                  { type: 'text', text: prompt },
   697	                  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
   698	                ],
   699	              },
   700	            ],
   701	            max_tokens: 500,
   702	          }),
   703	        })
   704	
   705	        const json = await res.json()
   706	        const content = json.choices?.[0]?.message?.content?.trim()
   707	
   708	        if (content) {
   709	          const parsed = JSON.parse(content)
   710	          if (parsed.merchant) setMerchant(parsed.merchant)
   711	          if (parsed.amount) setAmount(String(parsed.amount))
   712	          if (parsed.date) {
   713	            const d = new Date(parsed.date)
   714	            setSpentAtLocal(d.toISOString().slice(0, 16))
   715	          }
   716	          if (parsed.items && parsed.items.length > 0) {
   717	            setNotes(parsed.items.join(', '))
   718	          }
   719	
   720	          console.log('[App] Receipt processed:', parsed)
   721	        }
   722	      } catch (err) {
   723	        console.error('[App] processReceiptWithOCR error:', err)
   724	      } finally {
   725	        setIsProcessingReceipt(false)
   726	      }
   727	    },
   728	    [session]
   729	  )
   730	
   731	  // Helper: file to base64
   732	  function fileToBase64(file) {
   733	    return new Promise((resolve, reject) => {
   734	      const reader = new FileReader()
   735	      reader.onload = () => resolve(reader.result.split(',')[1])
   736	      reader.onerror = reject
   737	      reader.readAsDataURL(file)
   738	    })
   739	  }
   740	
   741	  // Helper: sanitize filename
   742	  function sanitizeFilename(name) {
   743	    return name.replace(/[^a-zA-Z0-9._-]/g, '_')
   744	  }
   745	
   746	  // ---------------------------------------------------------------------------
   747	  // Add expense
   748	  // ---------------------------------------------------------------------------
   749	  const addExpense = useCallback(
   750	    async (e) => {
   751	      e.preventDefault()
   752	
   753	      if (!merchant.trim() || !amount || !categoryId) {
   754	        alert('Please fill in merchant, amount, and category.')
   755	        return
   756	      }
   757	
   758	      const amountNum = parseFloat(amount)
   759	      if (isNaN(amountNum) || amountNum <= 0) {
   760	        alert('Amount must be a positive number.')
   761	        return
   762	      }
   763	
   764	      setIsSaving(true)
   765	      setSaveSuccess(false)
   766	
   767	      try {
   768	        const userId = session?.user?.id
   769	        if (!userId) throw new Error('No user ID')
   770	
   771	        // Upload receipt if present
   772	        let receiptImageUrl = null
   773	        if (receiptFile) {
   774	          const sanitized = sanitizeFilename(receiptFile.name)
   775	          const filePath = `${userId}/${Date.now()}_${sanitized}`
   776	          const { error: uploadError } = await supabase.storage
   777	            .from('receipts')
   778	            .upload(filePath, receiptFile)
   779	
   780	          if (uploadError) throw uploadError
   781	
   782	          const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filePath)
   783	          receiptImageUrl = urlData?.publicUrl || null
   784	        }
   785	
   786	        // Get geolocation
   787	        let location = null
   788	        if (navigator.geolocation) {
   789	          const pos = await new Promise((resolve, reject) => {
   790	            navigator.geolocation.getCurrentPosition(resolve, reject)
   791	          })
   792	          const { latitude, longitude } = pos.coords
   793	          location = await getLocationString(latitude, longitude)
   794	        }
   795	
   796	        // Parse tags
   797	        const tags = tagsText
   798	          .split(',')
   799	          .map((t) => t.trim())
   800	          .filter((t) => t)
   801	
   802	        // Insert expense
   803	        const { error: insertError } = await supabase.from('expenses').insert({
   804	          user_id: userId,
   805	          category_id: categoryId,
   806	          merchant: merchant.trim(),
   807	          amount: amountNum,
   808	          payment_method: paymentMethod,
   809	          spent_at: new Date(spentAtLocal).toISOString(),
   810	          status,
   811	          notes: notes.trim() || null,
   812	          tax_deductible: isTaxDeductible,
   813	          reimbursable: isReimbursable,
   814	          employer_or_client: employerOrClient.trim() || null,
   815	          tags: tags.length > 0 ? tags : null,
   816	          location: location || null,
   817	          receipt_image_url: receiptImageUrl,
   818	        })
   819	
   820	        if (insertError) throw insertError
   821	
   822	        // Reset form
   823	        setMerchant('')
   824	        setAmount('')
   825	        setCategoryId('')
   826	        setPaymentMethod('card')
   827	        setSpentAtLocal(getNowLocalDateTime())
   828	        setStatus('cleared')
   829	        setNotes('')
   830	        setIsTaxDeductible(false)
   831	        setIsReimbursable(false)
   832	        setEmployerOrClient('')
   833	        setTagsText('')
   834	        setReceiptFile(null)
   835	        setReceiptUrls([])
   836	        setShowMoreOptions(false)
   837	
   838	        setSaveSuccess(true)
   839	        setTimeout(() => setSaveSuccess(false), 3000)
   840	
   841	        // Reload expenses
   842	        await loadExpenses(userId)
   843	      } catch (err) {
   844	        console.error('[App] addExpense error:', err)
   845	        alert('Failed to add expense.')
   846	      } finally {
   847	        setIsSaving(false)
   848	      }
   849	    },
   850	    [
   851	      merchant,
   852	      amount,
   853	      categoryId,
   854	      paymentMethod,
   855	      spentAtLocal,
   856	      status,
   857	      notes,
   858	      isTaxDeductible,
   859	      isReimbursable,
   860	      employerOrClient,
   861	      tagsText,
   862	      receiptFile,
   863	      session,
   864	      loadExpenses,
   865	    ]
   866	  )
   867	
   868	  // Helper: reverse geocode location
   869	  async function getLocationString(lat, lon) {
   870	    try {
   871	      const res = await fetch(
   872	        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
   873	      )
   874	      const data = await res.json()
   875	      return data?.display_name || null
   876	    } catch (err) {
   877	      console.error('[App] getLocationString error:', err)
   878	      return null
   879	    }
   880	  }
   881	
   882	  // ---------------------------------------------------------------------------
   883	  // Update expense
   884	  // ---------------------------------------------------------------------------
   885	  const updateExpense = useCallback(
   886	    async (id, updates) => {
   887	      try {
   888	        const { error } = await supabase.from('expenses').update(updates).eq('id', id)
   889	
   890	        if (error) throw error
   891	
   892	        await loadExpenses(session?.user?.id)
   893	      } catch (err) {
   894	        console.error('[App] updateExpense error:', err)
   895	      }
   896	    },
   897	    [session, loadExpenses]
   898	  )
   899	
   900	  // ---------------------------------------------------------------------------
   901	  // Archive expense (soft delete)
   902	  // ---------------------------------------------------------------------------
   903	  const setArchivedForExpense = useCallback(
   904	    async (id, archived) => {
   905	      try {
   906	        const { error } = await supabase.from('expenses').update({ archived }).eq('id', id)
   907	
   908	        if (error) throw error
   909	
   910	        await loadExpenses(session?.user?.id)
   911	      } catch (err) {
   912	        console.error('[App] setArchivedForExpense error:', err)
   913	      }
   914	    },
   915	    [session, loadExpenses]
   916	  )
   917	
   918	  // Archive with undo banner
   919	  const archiveWithUndo = useCallback(
   920	    async (id) => {
   921	      const expense = expenses.find((e) => e.id === id)
   922	      if (!expense) return
   923	
   924	      await setArchivedForExpense(id, true)
   925	
   926	      setUndoBanner({
   927	        message: `Archived "${expense.merchant}"`,
   928	        undo: async () => {
   929	          await setArchivedForExpense(id, false)
   930	          setUndoBanner(null)
   931	        },
   932	      })
   933	
   934	      setTimeout(() => setUndoBanner(null), 5000)
   935	    },
   936	    [expenses, setArchivedForExpense]
   937	  )
   938	
   939	  // ---------------------------------------------------------------------------
   940	  // Delete expense
   941	  // ---------------------------------------------------------------------------
   942	  const deleteExpense = useCallback(
   943	    async (id) => {
   944	      if (!window.confirm('Permanently delete this expense?')) return
   945	
   946	      try {
   947	        const { error } = await supabase.from('expenses').delete().eq('id', id)
   948	
   949	        if (error) throw error
   950	
   951	        await loadExpenses(session?.user?.id)
   952	      } catch (err) {
   953	        console.error('[App] deleteExpense error:', err)
   954	      }
   955	    },
   956	    [session, loadExpenses]
   957	  )
   958	
   959	  // ---------------------------------------------------------------------------
   960	  // Open receipt image
   961	  // ---------------------------------------------------------------------------
   962	  const openReceipt = useCallback(async (receiptImageUrl) => {
   963	    try {
   964	      window.open(receiptImageUrl, '_blank')
   965	    } catch (err) {
   966	      console.error('[App] openReceipt error:', err)
   967	    }
   968	  }, [])
   969	
   970	  // ---------------------------------------------------------------------------
   971	  // Export CSV
   972	  // ---------------------------------------------------------------------------
   973	  const exportCsv = useCallback(() => {
   974	    if (allExpenses.length === 0) {
   975	      alert('No expenses to export.')
   976	      return
   977	    }
   978	
   979	    const headers = [
   980	      'Date',
   981	      'Merchant',
   982	      'Category',
   983	      'Amount',
   984	      'Payment Method',
   985	      'Status',
   986	      'Notes',
   987	    ]
   988	
   989	    const rows = allExpenses.map((e) => {
   990	      const cat = categories.find((c) => c.id === e.category_id)
   991	      return [
   992	        e.spent_at ? new Date(e.spent_at).toLocaleDateString() : '',
   993	        e.merchant || '',
   994	        cat?.name || '',
   995	        e.amount || 0,
   996	        e.payment_method || '',
   997	        e.status || '',
   998	        e.notes || '',
   999	      ]
  1000	    })
  1001	
  1002	    const csvContent = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')
  1003	
  1004	    const blob = new Blob([csvContent], { type: 'text/csv' })
  1005	    const url = URL.createObjectURL(blob)
  1006	    const a = document.createElement('a')
  1007	    a.href = url
  1008	    a.download = `expenses_${new Date().toISOString().slice(0, 10)}.csv`
  1009	    a.click()
  1010	    URL.revokeObjectURL(url)
  1011	  }, [allExpenses, categories])
  1012	
  1013	  function csvEscape(val) {
  1014	    if (val == null) return ''
  1015	    const str = String(val)
  1016	    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
  1017	      return `"${str.replace(/"/g, '""')}"`
  1018	    }
  1019	    return str
  1020	  }
  1021	
  1022	  // ---------------------------------------------------------------------------
  1023	  // Import flow
  1024	  // ---------------------------------------------------------------------------
  1025	  const handleTransactionsParsed = useCallback((transactions) => {
  1026	    setImportedTransactions(transactions)
  1027	  }, [])
  1028	
  1029	  const handleImport = useCallback(
  1030	    async (finalTransactions) => {
  1031	      try {
  1032	        const userId = session?.user?.id
  1033	        if (!userId) throw new Error('No user ID')
  1034	
  1035	        const rows = finalTransactions.map((t) => ({
  1036	          user_id: userId,
  1037	          category_id: t.category_id,
  1038	          merchant: t.merchant,
  1039	          amount: t.amount,
  1040	          payment_method: t.payment_method || 'card',
  1041	          spent_at: t.spent_at ? new Date(t.spent_at).toISOString() : new Date().toISOString(),
  1042	          status: t.status || 'cleared',
  1043	          notes: t.notes || null,
  1044	        }))
  1045	
  1046	        const { error } = await supabase.from('expenses').insert(rows)
  1047	
  1048	        if (error) throw error
  1049	
  1050	        alert(`Imported ${rows.length} expenses.`)
  1051	        setShowImport(false)
  1052	        setImportedTransactions([])
  1053	
  1054	        await loadExpenses(userId)
  1055	      } catch (err) {
  1056	        console.error('[App] handleImport error:', err)
  1057	        alert('Failed to import expenses.')
  1058	      }
  1059	    },
  1060	    [session, loadExpenses]
  1061	  )
  1062	
  1063	  const handleCancelImport = useCallback(() => {
  1064	    setShowImport(false)
  1065	    setImportedTransactions([])
  1066	  }, [])
  1067	
  1068	  // ---------------------------------------------------------------------------
  1069	  // Handle login (for Login component)
  1070	  // ---------------------------------------------------------------------------
  1071	  const handleLogin = useCallback(
  1072	    (session) => {
  1073	      setSession(session)
  1074	    },
  1075	    []
  1076	  )
  1077	
  1078	  // ---------------------------------------------------------------------------
  1079	  // Render: not logged in
  1080	  // ---------------------------------------------------------------------------
  1081	  if (!session) {
  1082	    return (
  1083	      <div style={{ padding: 40, textAlign: 'center' }}>
  1084	        <h1>Nova Expense Tracker</h1>
  1085	        <Login onLogin={handleLogin} />
  1086	      </div>
  1087	    )
  1088	  }
  1089	
  1090	  // ---------------------------------------------------------------------------
  1091	  // Render: logged in
  1092	  // ---------------------------------------------------------------------------
  1093	  return (
  1094	    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' }}>
  1095	      {/* Header */}
  1096	      <div
  1097	        style={{
  1098	          display: 'flex',
  1099	          justifyContent: 'space-between',
  1100	          alignItems: 'center',
  1101	          marginBottom: 20,
  1102	        }}
  1103	      >
  1104	        <h1 style={{ margin: 0 }}>Nova Expense Tracker</h1>
  1105	
  1106	        {/* User greeting (centered) */}
  1107	        {userName && (
  1108	          <div style={{ textAlign: 'center', flex: 1 }}>
  1109	            <div style={{ fontSize: 18, fontWeight: 'bold' }}>Hello {userName}</div>
  1110	            {userTitle && <div style={{ fontSize: 14, color: '#666' }}>{userTitle}</div>}
  1111	          </div>
  1112	        )}
  1113	
  1114	        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
  1115	          {/* Test mode toggle for admins */}
  1116	          {isAdmin && (
  1117	            <button
  1118	              onClick={() => setTestMode((prev) => !prev)}
  1119	              style={{
  1120	                padding: '8px 12px',
  1121	                background: testMode ? '#fbbf24' : '#10b981',
  1122	                color: '#fff',
  1123	                border: 'none',
  1124	                borderRadius: 6,
  1125	                cursor: 'pointer',
  1126	              }}
  1127	            >
  1128	              {testMode ? 'Test Mode (Basic)' : 'PRO Mode'}
  1129	            </button>
  1130	          )}
  1131	
  1132	          {/* Admin actions: Login History (admins only) */}
  1133	          {isAdmin && (
  1134	            <button
  1135	              onClick={() => setShowLoginHistory((prev) => !prev)}
  1136	              style={{
  1137	                padding: '8px 12px',
  1138	                background: '#3b82f6',
  1139	                color: '#fff',
  1140	                border: 'none',
  1141	                borderRadius: 6,
  1142	                cursor: 'pointer',
  1143	              }}
  1144	            >
  1145	              Login History
  1146	            </button>
  1147	          )}
  1148	
  1149	          {/* Admin actions: Analytics (admins only) */}
  1150	          {isAdmin && (
  1151	            <button
  1152	              onClick={() => setShowAnalytics((prev) => !prev)}
  1153	              style={{
  1154	                padding: '8px 12px',
  1155	                background: '#10b981',
  1156	                color: '#fff',
  1157	                border: 'none',
  1158	                borderRadius: 6,
  1159	                cursor: 'pointer',
  1160	              }}
  1161	            >
  1162	              Analytics
  1163	            </button>
  1164	          )}
  1165	
  1166	          {/* Import */}
  1167	          <button
  1168	            onClick={() => setShowImport((prev) => !prev)}
  1169	            style={{
  1170	              padding: '8px 12px',
  1171	              background: '#8b5cf6',
  1172	              color: '#fff',
  1173	              border: 'none',
  1174	              borderRadius: 6,
  1175	              cursor: 'pointer',
  1176	            }}
  1177	          >
  1178	            Import
  1179	          </button>
  1180	
  1181	          {/* Export */}
  1182	          <button
  1183	            onClick={exportCsv}
  1184	            style={{
  1185	              padding: '8px 12px',
  1186	              background: '#06b6d4',
  1187	              color: '#fff',
  1188	              border: 'none',
  1189	              borderRadius: 6,
  1190	              cursor: 'pointer',
  1191	            }}
  1192	          >
  1193	            Export CSV
  1194	          </button>
  1195	
  1196	          {/* Logout */}
  1197	          <button
  1198	            onClick={async () => {
  1199	              await supabase.auth.signOut()
  1200	              setSession(null)
  1201	            }}
  1202	            style={{
  1203	              padding: '8px 12px',
  1204	              background: '#ef4444',
  1205	              color: '#fff',
  1206	              border: 'none',
  1207	              borderRadius: 6,
  1208	              cursor: 'pointer',
  1209	            }}
  1210	          >
  1211	            Logout
  1212	          </button>
  1213	        </div>
  1214	      </div>
  1215	
  1216	      {/* Undo banner */}
  1217	      {undoBanner && (
  1218	        <div
  1219	          style={{
  1220	            background: '#fbbf24',
  1221	            color: '#000',
  1222	            padding: 12,
  1223	            borderRadius: 8,
  1224	            marginBottom: 20,
  1225	            display: 'flex',
  1226	            justifyContent: 'space-between',
  1227	            alignItems: 'center',
  1228	          }}
  1229	        >
  1230	          <span>{undoBanner.message}</span>
  1231	          <button
  1232	            onClick={undoBanner.undo}
  1233	            style={{
  1234	              background: '#fff',
  1235	              border: 'none',
  1236	              padding: '6px 12px',
  1237	              borderRadius: 6,
  1238	              cursor: 'pointer',
  1239	            }}
  1240	          >
  1241	            Undo
  1242	          </button>
  1243	        </div>
  1244	      )}
  1245	
  1246	      {/* Nova ChatAssistant - NOW VISIBLE TO ALL USERS */}
  1247	      {session?.user && (
  1248	        <div style={{ marginBottom: 20 }}>
  1249	          <ChatAssistant
  1250	            userId={session.user.id}
  1251	            expenses={allExpenses}
  1252	            categories={categories}
  1253	            onCommand={handleAICommand}
  1254	            notifications={[]}
  1255	            isProMode={isProMode}
  1256	          />
  1257	        </div>
  1258	      )}
  1259	
  1260	      {/* AI Insights (PRO only) */}
  1261	      {isProMode && aiInsights && (
  1262	        <div
  1263	          style={{
  1264	            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  1265	            color: '#fff',
  1266	            padding: 20,
  1267	            borderRadius: 12,
  1268	            marginBottom: 20,
  1269	          }}
  1270	        >
  1271	          <h3 style={{ margin: '0 0 10px 0' }}>AI Insights (PRO)</h3>
  1272	          <div>
  1273	            <strong>Forecast This Month:</strong> ${aiInsights.forecastTotal.toFixed(2)}
  1274	          </div>
  1275	          {aiInsights.recurringExpenses.length > 0 && (
  1276	            <div style={{ marginTop: 8 }}>
  1277	              <strong>Recurring Merchants:</strong> {aiInsights.recurringExpenses.join(', ')}
  1278	            </div>
  1279	          )}
  1280	          {aiInsights.categorySpending.length > 0 && (
  1281	            <div style={{ marginTop: 8 }}>
  1282	              <strong>Top Categories:</strong>
  1283	              <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
  1284	                {aiInsights.categorySpending.map((c) => (
  1285	                  <li key={c.name}>
  1286	                    {c.name}: ${c.spent.toFixed(2)}
  1287	                  </li>
  1288	                ))}
  1289	              </ul>
  1290	            </div>
  1291	          )}
  1292	        </div>
  1293	      )}
  1294	
  1295	      {/* Upgrade banner (free users only) */}
  1296	      {!isProMode && (
  1297	        <div
  1298	          style={{
  1299	            background: '#fef3c7',
  1300	            padding: 16,
  1301	            borderRadius: 8,
  1302	            marginBottom: 20,
  1303	            textAlign: 'center',
  1304	          }}
  1305	        >
  1306	          <strong>Upgrade to PRO</strong> for AI insights, forecasts, and more!
  1307	          <button
  1308	            onClick={() => setShowPaywall(true)}
  1309	            style={{
  1310	              marginLeft: 12,
  1311	              padding: '8px 16px',
  1312	              background: '#10b981',
  1313	              color: '#fff',
  1314	              border: 'none',
  1315	              borderRadius: 6,
  1316	              cursor: 'pointer',
  1317	            }}
  1318	          >
  1319	            Upgrade
  1320	          </button>
  1321	        </div>
  1322	      )}
  1323	
  1324	      {/* Paywall modal */}
  1325	      {showPaywall && (
  1326	        <div
  1327	          style={{
  1328	            position: 'fixed',
  1329	            top: 0,
  1330	            left: 0,
  1331	            right: 0,
  1332	            bottom: 0,
  1333	            background: 'rgba(0,0,0,0.5)',
  1334	            display: 'flex',
  1335	            alignItems: 'center',
  1336	            justifyContent: 'center',
  1337	            zIndex: 9999,
  1338	          }}
  1339	        >
  1340	          <div
  1341	            style={{
  1342	              background: '#fff',
  1343	              padding: 40,
  1344	              borderRadius: 12,
  1345	              maxWidth: 400,
  1346	              textAlign: 'center',
  1347	            }}
  1348	          >
  1349	            <h2>Upgrade to PRO</h2>
  1350	            <p>Unlock AI insights, forecasting, and advanced analytics.</p>
  1351	            <button
  1352	              onClick={() => {
  1353	                console.log('[App] Stripe checkout initiated')
  1354	                alert('Stripe checkout would open here.')
  1355	                setShowPaywall(false)
  1356	              }}
  1357	              style={{
  1358	                padding: '12px 24px',
  1359	                background: '#10b981',
  1360	                color: '#fff',
  1361	                border: 'none',
  1362	                borderRadius: 8,
  1363	                cursor: 'pointer',
  1364	                fontSize: 16,
  1365	              }}
  1366	            >
  1367	              Upgrade Now
  1368	            </button>
  1369	            <button
  1370	              onClick={() => setShowPaywall(false)}
  1371	              style={{
  1372	                marginTop: 12,
  1373	                padding: '8px 16px',
  1374	                background: '#e5e7eb',
  1375	                border: 'none',
  1376	                borderRadius: 6,
  1377	                cursor: 'pointer',
  1378	              }}
  1379	            >
  1380	              Cancel
  1381	            </button>
  1382	          </div>
  1383	        </div>
  1384	      )}
  1385	
  1386	      {/* Login History (admins only) */}
  1387	      {showLoginHistory && isAdmin && (
  1388	        <div style={{ marginBottom: 20 }}>
  1389	          <h3>Login History</h3>
  1390	          <div
  1391	            style={{
  1392	              padding: 20,
  1393	              background: '#f3f4f6',
  1394	              borderRadius: 8,
  1395	            }}
  1396	          >
  1397	            Login history will appear here.
  1398	          </div>
  1399	        </div>
  1400	      )}
  1401	
  1402	      {/* Analytics Dashboard (admins only) */}
  1403	      {showAnalytics && isAdmin && (
  1404	        <div style={{ marginBottom: 20 }}>
  1405	          <AnalyticsDashboard />
  1406	        </div>
  1407	      )}
  1408	
  1409	      {/* Import flow */}
  1410	      {showImport && importedTransactions.length === 0 && (
  1411	        <div style={{ marginBottom: 20 }}>
  1412	          <FileImport onTransactionsParsed={handleTransactionsParsed} />
  1413	        </div>
  1414	      )}
  1415	
  1416	      {showImport && importedTransactions.length > 0 && (
  1417	        <div style={{ marginBottom: 20 }}>
  1418	          <ImportPreview
  1419	            transactions={importedTransactions}
  1420	            categories={categories}
  1421	            onImport={handleImport}
  1422	            onCancel={handleCancelImport}
  1423	          />
  1424	        </div>
  1425	      )}
  1426	
  1427	      {/* Add expense form */}
  1428	      <AddExpenseForm
  1429	        categories={categories}
  1430	        amount={amount}
  1431	        setAmount={setAmount}
  1432	        merchant={merchant}
  1433	        setMerchant={setMerchant}
  1434	        categoryId={categoryId}
  1435	        setCategoryId={setCategoryId}
  1436	        paymentMethod={paymentMethod}
  1437	        setPaymentMethod={setPaymentMethod}
  1438	        spentAtLocal={spentAtLocal}
  1439	        setSpentAtLocal={setSpentAtLocal}
  1440	        status={status}
  1441	        setStatus={setStatus}
  1442	        notes={notes}
  1443	        setNotes={setNotes}
  1444	        isTaxDeductible={isTaxDeductible}
  1445	        setIsTaxDeductible={setIsTaxDeductible}
  1446	        isReimbursable={isReimbursable}
  1447	        setIsReimbursable={setIsReimbursable}
  1448	        employerOrClient={employerOrClient}
  1449	        setEmployerOrClient={setEmployerOrClient}
  1450	        tagsText={tagsText}
  1451	        setTagsText={setTagsText}
  1452	        receiptFile={receiptFile}
  1453	        setReceiptFile={setReceiptFile}
  1454	        receiptUrls={receiptUrls}
  1455	        isProcessingReceipt={isProcessingReceipt}
  1456	        processReceiptWithOCR={processReceiptWithOCR}
  1457	        showMoreOptions={showMoreOptions}
  1458	        setShowMoreOptions={setShowMoreOptions}
  1459	        isSaving={isSaving}
  1460	        saveSuccess={saveSuccess}
  1461	        addExpense={addExpense}
  1462	        isProMode={isProMode}
  1463	      />
  1464	
  1465	      {/* Monthly Summary */}
  1466	      <MonthlySummary expenses={allExpenses} categories={categories} />
  1467	
  1468	      {/* Expense list */}
  1469	      <ExpenseList
  1470	        expenses={expenses}
  1471	        categories={categories}
  1472	        updateExpense={updateExpense}
  1473	        archiveWithUndo={archiveWithUndo}
  1474	        deleteExpense={deleteExpense}
  1475	        openReceipt={openReceipt}
  1476	      />
  1477	    </div>
  1478	  )
  1479	}
  1480	
  1481	export default App