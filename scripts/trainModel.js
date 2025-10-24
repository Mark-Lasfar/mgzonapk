const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');
const trainingData = require('../chatbot/mgzon_oauth_training_data.json');

async function trainAndSaveModel() {
  try {
    // 1. Validate and build vocabulary
    const allText = trainingData
      .filter(entry => entry && typeof entry.question === 'string' && typeof entry.answer === 'string')
      .flatMap(entry => [
        entry.question || '',
        entry.answer || '',
        entry.explanation || '',
        entry.instructions || '',
        entry.section || ''
      ])
      .join(' ');
    
    if (!allText) {
      throw new Error('No valid text found in training data');
    }

    const words = allText.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    const uniqueWords = new Set(words);
    const vocabArray = Array.from(uniqueWords);
    const vocabSize = vocabArray.length;
    const maxSeqLen = 50; // For longer answers

    // Save vocab
    const vocabPath = path.join(__dirname, '../public/model/vocab.json');
    fs.mkdirSync(path.dirname(vocabPath), { recursive: true });
    fs.writeFileSync(vocabPath, JSON.stringify(vocabArray));
    console.log('Vocabulary saved:', vocabPath);

    // 2. Prepare data
    const questions = [];
    const answers = [];
    trainingData.forEach(entry => {
      if (entry && typeof entry.question === 'string' && typeof entry.answer === 'string' && entry.question.trim() && entry.answer.trim()) {
        const qTokens = tokenize(entry.question.toLowerCase(), vocabArray, maxSeqLen);
        const aTokens = tokenize(entry.answer.toLowerCase(), vocabArray, maxSeqLen);
        if (qTokens.length === maxSeqLen && aTokens.length === maxSeqLen) {
          questions.push(qTokens);
          answers.push(aTokens);
        }
      }
    });

    if (questions.length === 0 || answers.length === 0) {
      throw new Error('No valid question-answer pairs found in training data');
    }

    console.log(`Prepared ${questions.length} question-answer pairs`);

    // Reshape answers to 3D tensor [samples, maxSeqLen, 1]
    const xs = tf.tensor2d(questions, [questions.length, maxSeqLen]);
    const ys = tf.tensor3d(
      answers.map(a => a.map(token => [token])), // Convert each token to [token]
      [answers.length, maxSeqLen, 1]
    );

    // 3. Build model
    const model = tf.sequential();
    model.add(tf.layers.embedding({ inputDim: vocabSize, outputDim: 64, inputLength: maxSeqLen }));
    model.add(tf.layers.lstm({ units: 128, returnSequences: true }));
    model.add(tf.layers.lstm({ units: 128, returnSequences: true }));
    model.add(tf.layers.timeDistributed({ 
      layer: tf.layers.dense({ units: vocabSize, activation: 'softmax' })
    }));

    model.compile({ 
      optimizer: 'adam', 
      loss: 'sparseCategoricalCrossentropy', 
      metrics: ['accuracy'] 
    });

    // 4. Train
    console.log('Starting training with', questions.length, 'question-answer pairs...');
    await model.fit(xs, ys, { epochs: 50, batchSize: 16, verbose: 1 });
    console.log('Training complete!');

    // 5. Save model
    const savePath = 'file://' + path.join(__dirname, '../public/model');
    await model.save(savePath);
    console.log('Model saved to', savePath);
  } catch (err) {
    console.error('Error during training:', err);
  }
}

function tokenize(text, vocabArray, maxLen) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return Array(maxLen).fill(0);
  }
  const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 0);
  const seq = words.map(word => vocabArray.indexOf(word) !== -1 ? vocabArray.indexOf(word) : 0);
  const paddedLength = Math.max(0, maxLen - seq.length);
  return seq.slice(0, maxLen).concat(Array(paddedLength).fill(0));
}

trainAndSaveModel();