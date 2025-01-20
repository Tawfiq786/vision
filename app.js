import express from "express";
import * as fs from "fs";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import cors from 'cors';

app.use(cors()); 
dotenv.config();
const app = express();
const genAI=new GoogleGenerativeAI(process.env.API_KEY);


function fileToGenerativePart(path, mimeType){
    return{
        inlineData: {
            data: Buffer.from(fs.readFileSync(path)).toString("base64"),
            mimeType,
        },
    };
}


// app.use(express.static('public'));
app.use(express.json({ limit: '10mb' }));

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

app.post('/upload', (req, res) => {
    const { image } = req.body;
  
    if (!image) {
      return res.status(400).send({ message: 'No image data received.' });
    }
  
    // Extract base64 data and save it as a file
    const base64Data = image.replace(/^data:image\/png;base64,/, "");
    const filePath = 'uploads/captured-image.png';
  
    fs.writeFile(filePath, base64Data, 'base64', async (err) => {
      if (err) {
        console.error('Error saving the image:', err);
        return res.status(500).send({ message: 'Failed to save the image.' });
      }
      console.log('Image saved successfully:', filePath);
  
      // Run the AI analysis after the image is saved
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = "Analyze the provided image input and identify items, specifically only aluminum cans (label as Can), beer bottles (label Beer_Bottle), plastic bottles (label as Plastic_Bottle), and plastic milk jugs (label as Plastic_Jug). Return the detected items as a JSON list, where each object in the list contains two keys: item_quantity, an integer value for the total number of the specific detected item, and item_type, a string representing the item's type (using one of the four labels: Can, Beer_Bottle, Plastic_Bottle, or Plastic_Jug). PLEASE DO NOT INCLUDE ```json ``` in these lines";
        const imageParts = [fileToGenerativePart(filePath, "image/png")];
  
        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const text = await response.text();
  
        // Extract the JSON part from the response using regex
        // const match = text.match(/\[.*\]/);
        if (text) {
          try {
            const analysisResult = JSON.parse(text);  // Parse the cleaned JSON
            console.log("Analysis result:", analysisResult);
            res.json({ message: 'Image uploaded and analyzed successfully!', analysis: analysisResult });
          } catch (jsonError) {
            console.error("Error parsing JSON:", jsonError);
            res.status(500).send({ message: 'Failed to parse the analysis result.' });
          }
        } else {
          console.error("No JSON found in the response.");
          res.status(500).send({ message: 'No valid JSON found in the analysis result.' });
        }
      } catch (error) {
        console.error('Error during AI analysis:', error);
        res.status(500).send({ message: 'Failed to analyze the image.' });
      }
    });
  });
