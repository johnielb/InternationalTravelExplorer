library(httr)
library(dplyr)
library(stringr)

if (!exists("va")) stop("Load wrangle_va.R first!")
countries <- va$Country_of_residence %>% levels()
ports <- va$NZ_port %>% levels()
geo <- data.frame()

for (c in c(countries, ports)) {
  encoded_c <- URLencode(c) %>% 
    str_replace_all("%20", "+")
  query <- paste0("https://nominatim.openstreetmap.org/search?q=", encoded_c, "&format=json&limit=1")
  print(query)
  resp <- GET(query) %>% content()
  geo <- rbind(geo, c(c, resp[[1]]$lat, resp[[1]]$lon))
}
names(geo) <- c("Name", "Latitude", "Longitude")
geo <- geo %>%
  mutate(Latitude = as.numeric(Latitude), Longitude = as.numeric(Longitude))

save(geo, file = "data/geo.Rda")
