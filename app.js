import express from 'express';
import morgan from 'morgan';
const app = express();

app.use(morgan('combined'));

const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World from production!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
