const express = require('express');
const axios = require('axios');
const cors = require('cors'); // Import cors
const app = express();
const port = process.env.PORT || 5000;
const mongoose = require("mongoose");
const multer = require("multer");
const TextData = require('./models/text');
const fs = require('fs');
const path = require('path');

const folderPath = path.join(__dirname, 'uploads'); // Path to the folder containing files

app.use(cors()); // Enable CORS

// Ensure the uploads folder exists
if (!fs.existsSync(folderPath)) {
  fs.mkdirSync(folderPath);
}

// Endpoint to get a list of files
app.get('/files', (req, res) => {
  fs.readdir(folderPath, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return res.status(500).send('Unable to fetch files');
    }
    res.json(files);
  });
});

// Serve static files with custom headers
app.get('/files/:fileName', (req, res) => {
  const { fileName } = req.params;
  const filePath = path.join(folderPath, fileName); // Resolve the full file path
  console.log('Request for file:', fileName); // Debugging log

  if (fs.existsSync(filePath)) {
    const fileExtension = path.extname(fileName).toLowerCase();

    // Check file type and set headers accordingly
    if (fileExtension === '.pdf') {
      res.sendFile(filePath); // Serve PDFs inline
    } else {
      // For non-PDF files, suggest opening in a new tab
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.sendFile(filePath);
    }
  } else {
    console.log('File not found:', filePath); // Debugging log
    res.status(404).send('File not found');
  }
});

// Enable JSON parsing
app.use(express.json());

// MongoDB connection
mongoose.connect("mongodb+srv://himanshuu932:88087408601@cluster0.lu2g8bw.mongodb.net/pdforganizer?retryWrites=true&w=majority&appName=Cluster0", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => console.log("Connected to MongoDB"));

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads"); // Save files in 'uploads' directory
  },
  filename: (req, file, cb) => {
    cb(null, `${file.originalname}`);
  },
});
const upload = multer({ storage });

// Endpoint for file upload
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded.");
  console.log(req.file.path);

  try {
    const fileStream = fs.createReadStream(req.file.path); // Create a stream of the uploaded file

    const formData = new FormData();
    formData.append("file", fileStream, req.file.originalname);

    // Send the file to the Flask API
    const response = await axios.post("https://pythonpdf-13ms.onrender.com/extract", formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    const extractedText = response.data.text;

    const newTextData = new TextData({
      text: extractedText,
      filename: req.file.originalname,
      date: new Date(),
    });

    await newTextData.save();

    res.status(200).json({
      message: "File uploaded and text extracted successfully",
      textData: newTextData,
    });
  } catch (error) {
    console.error("Error during file upload or text extraction:", error);
    res.status(500).send("Error uploading file or extracting text.");
  }
});


// Route to delete a file
app.delete('/files/:fileName', async (req, res) => {
  const { fileName } = req.params;
  const filePath = path.join(folderPath, fileName); // Path to the file in storage

  try {
    // Check if the file exists in the storage folder
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found in storage" });
    }

    // Delete the file from the storage folder
    fs.unlinkSync(filePath);

    // Delete the corresponding document from the MongoDB collection
    const deletedDocument = await TextData.findOneAndDelete({ filename: fileName });

    if (!deletedDocument) {
      return res.status(404).json({ message: "File metadata not found in the database" });
    }

    res.status(200).json({ message: "File and metadata deleted successfully" });
  } catch (error) {
    console.error("Error during file deletion:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route to submit file and query
app.post('/submit-query', async (req, res) => {
  const { query } = req.body;
  //console.log(query);

  try {
    // Fetch all objects (documents) in the TextData collection
    const textDataArray = await TextData.find(); // Retrieve all documents

    if (textDataArray.length === 0) {
      return res.json({ answer: "No files in the storage" });
    }

    // Extract the text field from each document in the collection
    const texts = textDataArray.map((doc) => doc.text);
  
    // Send request to Flask API with the query and texts array
    const response = await axios.post('https://pythonpdf-13ms.onrender.com/pdf-query', {
      query: query,
      texts: texts,
    });

    // Return the response from the Flask API to the client
    res.json({ answer: response.data.answer });
    console.log(response.data.answer);
  } catch (error) {
    console.error('Error during API call or text retrieval:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Node.js server running at http://localhost:${port}`);
});
