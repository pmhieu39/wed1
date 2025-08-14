const http = require('http');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Server error');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { provider, apiKey, message } = JSON.parse(body || '{}');
        let url, headers, payload;
        if (provider === 'openai') {
          url = 'https://api.openai.com/v1/chat/completions';
          headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
          payload = JSON.stringify({ model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: message }] });
        } else if (provider === 'anthropic') {
          url = 'https://api.anthropic.com/v1/messages';
          headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
          payload = JSON.stringify({ model: 'claude-3-sonnet-20240229', max_tokens: 300, messages: [{ role: 'user', content: message }] });
        } else if (provider === 'gemini') {
          url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
          headers = { 'Content-Type': 'application/json' };
          payload = JSON.stringify({ contents: [{ parts: [{ text: message }] }] });
        } else {
          throw new Error('Unsupported provider');
        }

        const response = await fetch(url, { method: 'POST', headers, body: payload });
        const data = await response.json();
        let reply = 'Không có phản hồi';
        if (provider === 'openai') {
          reply = data?.choices?.[0]?.message?.content || reply;
        } else if (provider === 'anthropic') {
          reply = data?.content?.[0]?.text || reply;
        } else if (provider === 'gemini') {
          reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || reply;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
