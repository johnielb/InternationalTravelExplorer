# WRANGLE VISITOR ARRIVAL DATA
# Author: Johniel Bocacao
# Wrangle provisional visitor arrival comma-separated data from StatsNZ into JSON.

# 1. Set up environment =================================
library(dplyr)
library(tidyr)
library(jsonlite)
library(forcats)
library(stringr)
library(lubridate)
library(readr)

# 2. Load in visitor arrival (VA) data ======================================
va_raw <- read_csv(paste0("data/VisitorArrivals.csv"),
                    col_types = cols_only(Week_ended = col_date(format="%Y-%m-%d"),
                                          Country_of_residence = "f",
                                          NZ_port = "f",
                                          Length_of_stay = "f",
                                          Travel_purpose = "f",
                                          Count = "i"))
va_raw <- va_raw %>%
  rbind(read_csv("data/VisitorArrivals 20190414-20210718.csv",
                 col_types = cols_only(Week_ended = "D",
                                       Country_of_residence = "f",
                                       NZ_port = "f",
                                       Length_of_stay = "f",
                                       Travel_purpose = "f",
                                       Count = "i")) %>%
          filter(Week_ended < min(va_raw$Week_ended))) 

# TODO: Impute 2019-01-01 to 2019-04-14 visitor arrival data from ITM so % change can be calculated.

# 3. Wrangle visitor arrival (VA) data ======================================
va <- va_raw %>%
  filter(
    # Drop continental data, idk who needs to hear this at StatsNZ but please stop triple counting countries at the country, continent and total level!
    !(Country_of_residence %in% c("Africa and the Middle East", "Americas", "Asia", "Europe", "Oceania", "Total")),
    NZ_port != "Other"
  ) %>%
  mutate(Country_of_residence = factor(Country_of_residence) %>%
           # Truncate political stuff, easier to geocode
           fct_recode("China" = "China, People's Republic of", 
                      "Hong Kong" = "Hong Kong (Special Administrative Region)",
                      "South Korea" = "Korea, Republic of") %>% 
           fct_drop() %>% 
           fct_relevel(sort),
         NZ_port = factor(NZ_port) %>% 
           # Geocode totals as coming into New Zealand
           fct_recode("New Zealand" = "Total") %>% 
           fct_drop() %>% 
           fct_relevel(sort),
         Length_of_stay = factor(Length_of_stay) %>% 
           # Make meaningful in dropdown
           fct_recode("All lengths of stay" = "Total") %>% 
           fct_drop() %>% 
           fct_relevel(sort) %>% 
           fct_relevel("All lengths of stay"),
         Travel_purpose = factor(Travel_purpose) %>% 
           # Collapse tiny misc. categories into Other, conventions into Business
           fct_collapse("Other" = c("Other", "Not Stated", "Education"),
                        "Business" = c("Business", "Conventions/conferences")) %>%
           # Make meaningful in dropdown
           fct_recode("All purposes of travel" = "Total") %>% 
           fct_drop() %>% 
           fct_relevel(sort)
         ) %>%
  arrange(Week_ended, Country_of_residence, NZ_port, Travel_purpose, Length_of_stay) %>% 
  group_by(Week_ended, Country_of_residence, NZ_port, Travel_purpose, Length_of_stay) %>% 
  summarise(Count = sum(Count)) %>% 
  ungroup()
