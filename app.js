const express = require("express");
const path = require("path");
const morgan = require("morgan");
const { searchWikipedia } = require("./db");

const app = express();
app.use(morgan("dev")); // Logging middleware

// Set EJS view engine and static assets
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// GET /search with optional query params
app.get("/search", async (req, res) => {
  // Main and advanced search parameters
  const q = req.query.q || "";
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const offset = (page - 1) * limit;
  const words = req.query.words || "";
  const exact = req.query.exact || "";
  const exclude = req.query.exclude || "";
  const oneof = req.query.oneof || "";

  // Perform real database search with pagination
  const { rows: results, totalCount } = await searchWikipedia(
    q,
    limit,
    offset,
    words,
    exact,
    exclude,
    oneof
  );
  const countStart = offset + 1;
  const countEnd = offset + results.length;
  const countTotal = totalCount;

  // Render results
  res.render("index", {
    q,
    words,
    exact,
    exclude,
    oneof,
    results,
    countStart,
    countEnd,
    countTotal,
    page,
    limit,
  });
});

// Redirect root to /search
app.get("/", (req, res) => res.redirect("/search"));

const PORT = +process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
