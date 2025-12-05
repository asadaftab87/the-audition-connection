import express from "express";
import { exec } from "child_process";

const app = express();
app.use(express.json());

app.post("/run-scraper", (req, res) => {
  exec("node scraper.js", (err, stdout, stderr) => {
    if (err) {
      console.error("Error:", err);
      return res.status(500).send("Scraper error");
    }
    console.log("Output:", stdout);
    res.send("Scraper executed successfully");
  });
});

app.listen(4000, () => console.log(" Listener running on port 4000"));
