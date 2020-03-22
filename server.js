const express = require("express");
const bodyParser = require("body-parser");

const app = express();

let port = process.env.PORT || 5000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

//middleware for input validation
app.use((req, res, next) => {
  const { address } = req.query;

  if (!address) {
    res.status(400).send({ success: false, message: "Missing address field" });
  } else {
    next();
  }
});

const vrboRoutes = require("./routes/vrboRoutes"); //importing vrbo route
vrboRoutes(app); //register the route

//middleware to handle unknown routes/methods
app.use((req, res) => {
  res
    .status(404)
    .send({ success: false, message: req.method + " route does not exist" });
});

// launch backend onto a port
app.listen(port, () => console.log(`LISTENING ON PORT ${port}`));
