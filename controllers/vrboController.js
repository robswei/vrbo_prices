const cheerio = require("cheerio");
const csvjson = require("csvjson");

const promise = require("bluebird");
const rp = require("request-promise");

let constants = require("../constants");
let helpers = require("../helpers");

exports.nightly_prices = async function(req, res) {
  //Structure address for VRBO request
  let address = req.query.address
    .replace(/[^\w\s]/gi, "")
    .toLowerCase()
    .split(" ")
    .join("-");

  //Call VRBO listing endpoint
  const options = helpers.createRequestOptions("POST", { address: address });

  let listings = [];

  await rp(options).then(response => {
    let results = response.data.results;

    let coordinates = results.geography.location;

    //Only push the listings that are within the range of the provided radius
    results.listings.forEach(property => {
      let distance = helpers.distanceCoords(
        coordinates.latitude,
        coordinates.longitude,
        property.geoCode.latitude,
        property.geoCode.longitude
      );
      if (
        distance <= (req.query.radius || constants.DEFAULT_RADIUS) &&
        property.detailPageUrl
      ) {
        listings.push({
          distance: distance,
          url: constants.ROOT_VRBO_URL + property.detailPageUrl
        });
      }
    });
  });

  let csvResponseArray = await promise.map(
    listings,
    property => {
      const options = helpers.createRequestOptions("GET", {
        url: property.url
      });

      return rp(options)
        .then(response => {
          //Using cheerio to parse the html response data
          const $ = cheerio.load(response);
          let inital_state = $("body > script")[0]
            .children[0].data.replace(/;|window.__INITIAL_STATE__ =/g, "")
            .split("window.__SITE_CONTEXT__")[0];
          let listing = JSON.parse(inital_state).listingReducer;

          //Create the CSV response object, prefilled with listing data
          let csvReturn = helpers.createReturnCSV(listing, property);

          //Converts VRBO date string to JavaScript date for the rate and availability start value
          let rateStart = helpers.createDate(listing.rateSummary.beginDate);
          let availState = helpers.createDate(
            listing.availabilityCalendar.availability.dateRange.beginDate
          );

          //Determine index into rate/prices array and availability string from VRBO data
          let current_rate_date_idx = helpers.createOffset(rateStart);
          let current_avail_date_idx = helpers.createOffset(availState);

          // Availability string from VRBO request
          let availability = listing.availabilityCalendar.availability.unitAvailabilityConfiguration.availability.substr(
            current_avail_date_idx,
            constants.ONE_YEAR_DAYS
          );

          // Calculate the 3 highest nightly prices
          let first = 0,
            second = 0,
            third = 0;

          // Create properties for the highest price in the CSV response object
          for (let i = 1; i <= constants.HIGHEST_PRICES; i++) {
            csvReturn["highest_price:" + i] = "";
          }

          // Compares the given date to the current price leaders
          let findHighestPrices = (rent, idx, current_date) => {
            if (availability.charAt(idx) === "Y") {
              // If rent is greater than first, second or third, update csv response object
              if (rent > first) {
                csvReturn["highest_price:3"] = csvReturn["highest_price:2"];
                csvReturn["highest_price:2"] = csvReturn["highest_price:1"];
                csvReturn["highest_price:1"] = current_date + " $" + rent;

                third = second;
                second = first;
                first = rent;
              } else if (rent > second) {
                csvReturn["highest_price:3"] = csvReturn["highest_price:2"];
                csvReturn["highest_price:2"] = current_date + " $" + rent;

                third = second;
                second = rent;
              } else if (rent > third) {
                csvReturn["highest_price:3"] = current_date + " $" + rent;

                third = rent;
              }
            }
          };

          // Create properties for the nightly price in the CSV response object and calculate highest price
          let csvNightlyPrices = (price, idx) => {
            let current_date = helpers.setDate(
              rateStart,
              idx + current_rate_date_idx
            );

            findHighestPrices(price, idx, current_date);

            csvReturn[current_date + ":price"] = price;
            csvReturn[current_date + ":available"] =
              availability.charAt(idx) === "Y" ? true : false;
          };

          //If the rent prices dont exist, populate new array with average price
          let fillPriceArray = price => {
            for (let i = 0; i < availability.length; i++) {
              csvNightlyPrices(price, i);
            }
          };

          //Iterate over one year of rent prices
          listing.rateSummary.rentNights
            ? listing.rateSummary.rentNights
                .splice(current_rate_date_idx, constants.ONE_YEAR_DAYS)
                .forEach((rent, idx) => {
                  csvNightlyPrices(rent, idx);
                })
            : fillPriceArray(listing.averagePrice.value);

          return csvReturn;
        })
        .catch(err => {
          res.status(500).send({ success: false, message: err.message });
        });
    },
    { concurrency: constants.MAX_LISTINGS }
  );

  // Check if any listings are found
  if (csvResponseArray.length > 0) {
    // Convert json object to csv
    const csvData = csvjson.toCSV(csvResponseArray, {
      headers: "key"
    });

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="' + address + '.csv"'
    );
    res.set("Content-Type", "text/csv");
    res.status(200).send(csvData);
  } else {
    res.status(400).send({ success: false, message: "No listings found" });
  }
};
