const crypto = require('crypto');
const axios = require('axios');

module.exports = async (req, res) => {
  const { host } = req.headers;
  const url = new URL(req.url, `https://${host}`);
  const scope = 'repo,user';
  const provider = 'github';
  
  const client_id = process.env.OAUTH_CLIENT_ID;
  const client_secret = process.env.OAUTH_CLIENT_SECRET;

  if (url.pathname === '/login') {
    const state = crypto.randomBytes(16).toString('hex');
    res.writeHead(302, {
      Location: `https://github.com/login/oauth/authorize?client_id=${client_id}&scope=${scope}&state=${state}`
    });
    return res.end();
  }

  if (url.pathname === '/callback') {
    const code = url.searchParams.get('code');
    try {
      const response = await axios.post('https://github.com/login/oauth/access_token', {
        client_id,
        client_secret,
        code
      }, {
        headers: { Accept: 'application/json' }
      });

      const { access_token, error } = response.data;
      
      let content, status;
      if (error) {
        content = JSON.stringify({ error });
        status = 'error';
      } else {
        content = JSON.stringify({ token: access_token, provider });
        status = 'success';
      }

      const script = `
        <script>
          (function() {
            function recieveMessage(e) {
              window.opener.postMessage("authorization:${provider}:${status}:${content}", e.origin);
            }
            window.addEventListener("message", recieveMessage, false);
            window.opener.postMessage("authorizing:${provider}", "*");
          })();
        </script>
      `;
      res.setHeader('Content-Type', 'text/html');
      return res.end(script);
    } catch (err) {
      res.statusCode = 500;
      return res.end(err.message);
    }
  }

  res.statusCode = 404;
  return res.end('Not Found');
};
