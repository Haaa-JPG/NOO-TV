const fs = require('fs');
const content = fs.readFileSync('C:/Users/Hashi/.local/share/opencode/tool-output/tool_fcccafc96001nxI0bbMW7WrdQQ', 'utf8');
const links = content.match(/href="https:\/\/www\.qrmzi\.tv\/[^"]+"/g);
if (links) {
  const unique = [...new Set(links)].filter(l => !l.includes('wp-content') && !l.includes('wp-admin')).slice(0, 30);
  unique.forEach(l => console.log(l));
}
