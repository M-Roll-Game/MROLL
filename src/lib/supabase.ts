import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://djwccijoepxwovunbglw.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2NjaWpvZXB4d292dW5iZ2x3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Njg3NDUsImV4cCI6MjA5NzU0NDc0NX0.vyYwTsHUOeTx1S3RDd_DmbrhqZTLPQ_89czqLQst3ks'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)