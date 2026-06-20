import os
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Integer, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship

app = FastAPI()

# --- إعدادات CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],
)

# --- إعدادات قاعدة بيانات SQLite ---
DATABASE_URL = "sqlite:///./database.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# --- بناء الجداول (SQLAlchemy Models) ---

class UserModel(Base):
    __tablename__ = "users"

    email = Column(String, primary_key=True, index=True)
    name = Column(String)
    password = Column(String)
    transaction_id = Column(String)
    status = Column(String, default="pending")
    
    designs = relationship("DesignModel", back_populates="owner", cascade="all, delete-orphan")

class DesignModel(Base):
    __tablename__ = "designs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_email = Column(String, ForeignKey("users.email"))
    car_name = Column(String)
    modification = Column(String)
    image_url = Column(Text)  

    owner = relationship("UserModel", back_populates="designs")


Base.metadata.create_all(bind=engine)


# --- الـ Schemas المستقبلة (Pydantic) ---
class UserRegisterSchema(BaseModel):
    name: str
    email: str
    password: str
    transaction_id: str

class ActivateSchema(BaseModel):
    email: str

class SaveDesignSchema(BaseModel):
    user_email: str
    car_name: str
    modification: str
    image_url: str


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- المسارات العامة ومسارات المستخدمين ---

@app.get("/")
def home():
    return {"message": "AutoCollo DZ API is running successfully!"}

@app.post("/register-secure")
def register_secure(user_data: UserRegisterSchema, db: Session = Depends(get_db)):
    db_user = db.query(UserModel).filter(UserModel.email == user_data.email).first()
    if db_user:
        return {"status": db_user.status, "message": "الطلب موجود مسبقاً."}

    new_user = UserModel(
        name=user_data.name,
        email=user_data.email,
        password=user_data.password,
        transaction_id=user_data.transaction_id,
        status="pending"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"status": "pending", "message": "تم إرسال طلبك بنجاح!"}

@app.get("/check-status/{email}")
def check_status(email: str, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.email == email).first()
    if user:
        return {"status": user.status}
    return {"status": "not_found"}


# --- مسارات المعرض (Gallery Endpoints) ---

@app.get("/gallery/{user_email}")
def get_user_gallery(user_email: str, db: Session = Depends(get_db)):
    return db.query(DesignModel).filter(DesignModel.user_email == user_email).all()

@app.post("/gallery/save")
def save_user_design(data: SaveDesignSchema, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.email == data.user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
        
    new_design = DesignModel(
        user_email=data.user_email,
        car_name=data.car_name,
        modification=data.modification,
        image_url=data.image_url
    )
    db.add(new_design)
    db.commit()
    db.refresh(new_design)
    return {"message": "تم حفظ التصميم في معرضك بنجاح!"}

@app.delete("/gallery/delete/{design_id}")
def delete_user_design(design_id: int, db: Session = Depends(get_db)):
    design = db.query(DesignModel).filter(DesignModel.id == design_id).first()
    if not design:
        raise HTTPException(status_code=404, detail="التصميم غير موجود")
    
    db.delete(design)
    db.commit()
    return {"message": "تم حذف التصميم بنجاح!"}


# --- مسارات لوحة تحكم الأدمن (Admin) ---

@app.get("/admin/users")
def get_all_users(db: Session = Depends(get_db)):
    return {"users": db.query(UserModel).all()}

@app.post("/admin/activate")
def activate_user(data: ActivateSchema, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="الحساب غير موجود")
    user.status = "active"
    db.commit()
    return {"message": f"تم تفعيل حساب {data.email} بنجاح!"}

@app.post("/admin/deactivate")
def deactivate_user(data: ActivateSchema, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="الحساب غير موجود")
    user.status = "pending"
    db.commit()
    return {"message": f"تم إلغاء تفعيل حساب {data.email}."}

@app.delete("/admin/delete")
def delete_user(data: ActivateSchema, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.email == data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="الحساب غير موجود")
    db.delete(user)
    db.commit()
    return {"message": f"تم حذف حساب {data.email} نهائياً."}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)