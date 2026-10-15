class ValidationError(Exception):
    """A request failed validation. Mapped to HTTP 400."""


class NotFoundError(Exception):
    """The requested resource does not exist. Mapped to HTTP 404."""
