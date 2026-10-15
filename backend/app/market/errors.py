class MarketDataError(Exception):
    """The price source could not be reached or returned an unusable response.

    Distinct from "ticker not found", which add_ticker reports by returning False.
    """
