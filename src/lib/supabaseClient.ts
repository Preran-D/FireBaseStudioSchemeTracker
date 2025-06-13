import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kxuwvqkspitqnoshytne.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4dXd2cWtzcGl0cW5vc2h5dG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MTg0NTcsImV4cCI6MjA2NTM5NDQ1N30.sSARsBqrMGOGJCxoSdP6OFsjPBW58CbwNpDrIiBhlyM';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and anon key are required.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
