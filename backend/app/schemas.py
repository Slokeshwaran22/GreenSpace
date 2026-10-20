
from pydantic import BaseModel, Field, ConfigDict


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    username: str = Field(min_length=3, max_length=60)
    phone: str = Field(min_length=10, max_length=10)
    email: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=8, max_length=16)


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)
    remember_me: bool = False


class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str = Field(min_length=1, max_length=254)


class VerifyOTPRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str = Field(min_length=1, max_length=254)
    otp: str = Field(pattern=r"^\d{6}$")


class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str = Field(min_length=1, max_length=254)
    new_password: str = Field(min_length=8, max_length=16)
    confirm_password: str = Field(min_length=8, max_length=16)
