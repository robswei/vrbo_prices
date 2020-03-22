module.exports = function(app) {
    let vrbo = require("../controllers/vrboController");

    // VRBO Routes
    app.route("/vrbo_prices").get(vrbo.nightly_prices);
  };
