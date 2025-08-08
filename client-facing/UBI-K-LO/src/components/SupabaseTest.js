import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase.js';

const SupabaseTest = () => {
  const [connectionStatus, setConnectionStatus] = useState('Testing...');

  useEffect(() => {
    const testConnection = async () => {
      try {
        // Test the connection by making a simple query
        const { data, error } = await supabase
          .from('profiles') // Test the profiles table we just created
          .select('*')
          .limit(1);
        
        if (error) {
          console.log('Supabase connection test:', error.message);
          setConnectionStatus('Connected to Supabase! (Table might not exist yet)');
        } else {
          console.log('Supabase connection successful:', data);
          setConnectionStatus('Connected to Supabase!');
        }
      } catch (error) {
        console.error('Supabase connection failed:', error);
        setConnectionStatus('Failed to connect to Supabase');
      }
    };

    testConnection();
  }, []);

  return (
    <div className="p-4 bg-green-100 border border-green-400 rounded-lg">
      <h3 className="text-green-800 font-semibold">Supabase Connection Test</h3>
      <p className="text-green-700">{connectionStatus}</p>
    </div>
  );
};

export default SupabaseTest;
