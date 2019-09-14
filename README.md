This is an electron app I made for work. It uses 2011 census data for journeys to work to find proportions of people travelling from one area to another.

The basic principle is that you look at commuter travel at the regional level, then filter out regions with a low proportion. For all remaining regions, filter out Local Authority areas with a low proportion, then repeat for MSOAs (these are smaller areas defined by the census people)

This approach is used often in transport planning to estimate future traffic flows along road networks prior to capacity modelling of junctions and links, mostly for minor projects.

No license is given so no permission for modifications/distribution, however feel free to clone & run using "npm start"
