const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
const dbPath = path.join(__dirname, "bookStore.db");
const PORT = process.env.PORT || 3000;

app.use(express.json());

let db;

const sampleBooks = [
  ["Harry Potter", "J.K. Rowling", 500, 350],
  ["The Hobbit", "J.R.R. Tolkien", 450, 300],
  ["Wings of Fire", "A.P.J. Abdul Kalam", 300, 200],
  ["Atomic Habits", "James Clear", 600, 320],
  ["Rich Dad Poor Dad", "Robert Kiyosaki", 400, 250],
  ["The Alchemist", "Paulo Coelho", 350, 180],
  ["Think and Grow Rich", "Napoleon Hill", 550, 280],
  ["Ikigai", "Hector Garcia", 400, 190],
  ["Deep Work", "Cal Newport", 450, 250],
  ["The Power of Habit", "Charles Duhigg", 500, 300],
];

const initializeDatabase = async () => {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS book (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      price INTEGER NOT NULL,
      pages INTEGER NOT NULL
    );
  `);

  const { count } = await db.get("SELECT COUNT(*) AS count FROM book;");
  if (count === 0) {
    const insertBook = await db.prepare(`
      INSERT INTO book (title, author, price, pages)
      VALUES (?, ?, ?, ?);
    `);

    try {
      for (const book of sampleBooks) {
        await insertBook.run(book);
      }
    } finally {
      await insertBook.finalize();
    }
  }
};

const asyncHandler = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

const getBookFields = (body) => {
  const { title, author, price, pages } = body || {};

  if (
    typeof title !== "string" ||
    title.trim() === "" ||
    typeof author !== "string" ||
    author.trim() === "" ||
    !Number.isInteger(price) ||
    price < 0 ||
    !Number.isInteger(pages) ||
    pages <= 0
  ) {
    return null;
  }

  return [title.trim(), author.trim(), price, pages];
};

app.get(
  "/books/",
  asyncHandler(async (request, response) => {
    const books = await db.all("SELECT * FROM book ORDER BY id;");
    response.status(200).send(books);
  }),
);

app.get(
  "/books/:bookId/",
  asyncHandler(async (request, response) => {
    const book = await db.get("SELECT * FROM book WHERE id = ?;", [
      request.params.bookId,
    ]);

    if (!book) {
      response.status(404).send("Book Not Found");
      return;
    }

    response.status(200).send(book);
  }),
);

app.post(
  "/books/",
  asyncHandler(async (request, response) => {
    const bookFields = getBookFields(request.body);
    if (!bookFields) {
      response
        .status(400)
        .send("Provide a non-empty title and author, a non-negative integer price, and a positive integer page count");
      return;
    }

    await db.run(
      "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?);",
      bookFields,
    );
    response.status(201).send("Book Added Successfully");
  }),
);

app.put(
  "/books/:bookId/",
  asyncHandler(async (request, response) => {
    const bookFields = getBookFields(request.body);
    if (!bookFields) {
      response
        .status(400)
        .send("Provide a non-empty title and author, a non-negative integer price, and a positive integer page count");
      return;
    }

    const result = await db.run(
      `UPDATE book
       SET title = ?, author = ?, price = ?, pages = ?
       WHERE id = ?;`,
      [...bookFields, request.params.bookId],
    );

    if (result.changes === 0) {
      response.status(404).send("Book Not Found");
      return;
    }

    response.status(200).send("Book Updated Successfully");
  }),
);

app.delete(
  "/books/:bookId/",
  asyncHandler(async (request, response) => {
    const result = await db.run("DELETE FROM book WHERE id = ?;", [
      request.params.bookId,
    ]);

    if (result.changes === 0) {
      response.status(404).send("Book Not Found");
      return;
    }

    response.status(200).send("Book Deleted Successfully");
  }),
);

app.use((error, request, response, next) => {
  console.error(error);
  if (response.headersSent) {
    next(error);
    return;
  }
  response.status(500).send("Internal Server Error");
});

const initializeDBAndServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server Running at http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error(`DB Error: ${error.message}`);
    process.exitCode = 1;
  }
};

if (require.main === module) {
  initializeDBAndServer();
}

module.exports = app;
