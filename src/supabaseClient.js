import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sxbybsclzxjtwomwowdk.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4Ynlic2NsenhqdHdvbXdvd2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MjU0ODUsImV4cCI6MjA4MzUwMTQ4NX0.hXCJ7ocbzIBEbcOQeItesh4dDjdS8BV3mPkV96OSrJ0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
