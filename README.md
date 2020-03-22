# vrbo_prices
Tool to pull VRBO listings and relative rent prices

### Install
````
cd vrbo_prices
npm install
````

### Start
````
npm start
````

The API runs on port ````5000```` by default, and the root can be accessed by navigating to ````http://localhost:5000/```` in your browser.

# Current Routes

| Method | Route | Query Params | Response |
| --- | --- | --- | --- |
| `GET` | `/vrbo_prices` | `address: string`, `radius: number` | Scrapes VRBO pricing and returns listing prices for one year |