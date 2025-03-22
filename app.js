import express from "express";
import * as fs from "fs";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import cors from 'cors';

dotenv.config();
const app = express();
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
app.use(cors());

function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType,
    },
  };
}

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

  const base64Data = image.replace(/^data:image\/png;base64,/, "");
  const filePath = 'uploads/captured-image.png';

  fs.writeFile(filePath, base64Data, 'base64', async (err) => {
    if (err) {
      console.error('Error saving the image:', err);
      return res.status(500).send({ message: 'Failed to save the image.' });
    }
    console.log('Image saved successfully:', filePath);

    try {
      // First API Call: Analyze items in the image
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = "Analyze the provided image input and identify items, specifically only aluminum cans (label as Can), beer bottles (label Beer_Bottle), plastic bottles (label as Plastic_Bottle), and plastic milk jugs (label as Plastic_Jug). Return the detected items as a JSON list.";
      const imageParts = [fileToGenerativePart(filePath, "image/png")];
      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = await response.text();

      let analysisResult = null;
      if (text) {
        try {
          analysisResult = JSON.parse(text);
          console.log("Analysis result:", analysisResult);
        } catch (jsonError) {
          console.error("Error parsing JSON:", jsonError);
          return res.status(500).send({ message: 'Failed to parse the analysis result.' });
        }
      }

      // Second API Call: Analyze recyclability
      setTimeout(async () => {
        const recyclabilityPrompt = "Analyze the provided image for the recyclability of its contents. Provide a concise statement that includes a description of the recyclable items and their potential for different recycling processes. The negative environmental impact of improper disposal. The positive environmental impact of recycling, including an interesting fact with quantifiable benefits related to recycling a specific number of the depicted items. State only the final statement, without any extra preamble or explanation.";
        const recyclabilityResult = await model.generateContent([recyclabilityPrompt, ...imageParts]);
        const recyclabilityResponse = await recyclabilityResult.response;
        const recyclabilityText = await recyclabilityResponse.text();

        res.json({
          message: 'Image uploaded and analyzed successfully!',
          analysis: analysisResult,
          recyclability: recyclabilityText,
        });
      }, 2000); // Wait for 2 seconds before making the second call

    } catch (error) {
      console.error('Error during AI analysis:', error);
      res.status(500).send({ message: 'Failed to analyze the image.' });
    }
  });
});
