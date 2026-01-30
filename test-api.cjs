async function testApi() {
  try {
    console.log('Testing leads API...');
    const response = await fetch('http://localhost:3001/api/leads');
    console.log('Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('Response data:');
      console.log('  leads length:', data.leads?.length || 0);
      console.log('  lastSyncAt:', data.lastSyncAt);
      console.log('  diagnostics:', JSON.stringify(data.diagnostics, null, 2));
    } else {
      console.log('Error response:', await response.text());
    }
  } catch (error) {
    console.error('API test failed:', error.message);
  }
}

testApi();