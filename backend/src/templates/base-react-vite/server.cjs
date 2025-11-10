const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 8080;
const distPath = path.join(__dirname, "dist");

// Serve static files from the 'dist' directory
app.use(express.static(distPath));

// Handle SPA routing: for any other request, send the index.html file
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
