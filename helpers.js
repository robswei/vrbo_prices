let constants = require("./constants");

//Used in distance between coordinates calculation
let degreesToRadians = degrees => {
  return (degrees * Math.PI) / 180;
};

//Calculates distance in miles between 2 coord points
exports.distanceCoords = (lat1, lon1, lat2, lon2) => {
  // Calculation and explanation for variable names here: http://www.movable-type.co.uk/scripts/latlong.html
  let rad_lat = degreesToRadians(lat2 - lat1);
  let rad_lon = degreesToRadians(lon2 - lon1);

  lat1 = degreesToRadians(lat1);
  lat2 = degreesToRadians(lat2);

  let a =
    Math.sin(rad_lat / 2) * Math.sin(rad_lat / 2) +
    Math.sin(rad_lon / 2) *
      Math.sin(rad_lon / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);
  let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((constants.EARTH_RADIUS_MI * c + Number.EPSILON) * 10) / 10;
};

//Parse VRBO listing and initialize the csv with listing info
exports.createReturnCSV = (listing, property) => ({
  id: listing.propertyId,
  job_listing: listing.listingNumber,
  name: listing.propertyName ? listing.propertyName : listing.headline,
  type: listing.propertyType,
  ["coordinates:lat"]: listing.geoCode.latitude,
  ["coordinates:long"]: listing.geoCode.longitude,
  amenities: listing.featuredAmenities
    .map(item => item.toLowerCase())
    .join("; "),
  bathroom_total: listing.bathrooms.full + 0.5 * listing.bathrooms.half,
  bedroom_total: listing.bedrooms,
  sleeps: listing.sleeps,
  size: listing.area,
  rating: Math.round((listing.averageRating + Number.EPSILON) * 10) / 10,
  distance: property.distance
});

//Create new JavaScript date
exports.createDate = date => new Date(date);

//Calculate offset into VRBO data arrays for current date
exports.createOffset = date =>
  Math.floor(Math.abs(new Date() - date) / (24 * 60 * 60 * 1000));

//Format date given offset
exports.setDate = (rate_date, offset) => {
  let date = new Date(rate_date.getTime() + offset * 24 * 60 * 60 * 1000);

  return (
    date.getUTCMonth() +
    1 +
    "-" +
    date.getUTCDate() +
    "-" +
    date.getUTCFullYear()
  );
};

//Generate request options given type
exports.createRequestOptions = (type, data) => {
  switch (type) {
    case "GET":
      return {
        method: "GET",
        uri: data.url,
        json: true
      };
    case "POST":
      return {
        method: "POST",
        uri: constants.LISTINGS_ENDPOINT,
        body: {
          operationName: "SearchRequestQuery",
          variables: {
            request: {
              q: data.address,
              paging: {
                page: 1,
                pageSize: constants.MAX_LISTINGS
              }
            },
            gtsQuery: true,
            isBot: false
          },
          query: constants.LISTINGS_QUERY
        },
        json: true
      };
    default:
      return;
  }
};
