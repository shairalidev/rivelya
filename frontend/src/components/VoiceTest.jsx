import { useState } from 'react';
import client from '../api/client.js';
import toast from 'react-hot-toast';

export default function VoiceTest() {
  const [isCreating, setIsCreating] = useState(false);

  const createTestSession = async () => {
    setIsCreating(true);
    try {
      // This would normally be called with a real master ID
      const response = await client.post('/session/voice', {
        master_id: '507f1f77bcf86cd799439011' // Test master ID
      });
      
      toast.success('Test voice session created!');
      console.log('Session created:', response.data);
      
      // Redirect to the voice page
      window.location.href = `/voice/${response.data.session_id}`;
    } catch (error) {
      console.error('Error creating test session:', error);
      toast.error('Failed to create test session');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '20px', borderRadius: '8px' }}>
      <h3>Voice Test Component</h3>
      <p>This is a test component to create a voice session for testing purposes.</p>
      <button 
        onClick={createTestSession}
        disabled={isCreating}
        style={{
          padding: '10px 20px',
          backgroundColor: '#6d5bff',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: isCreating ? 'not-allowed' : 'pointer',
          opacity: isCreating ? 0.6 : 1
        }}
      >
        {isCreating ? 'Creating...' : 'Create Test Voice Session'}
      </button>
    </div>
  );
}