import pdfplumber
from docx import Document
from typing import Tuple
import os

class ResumeParser:
    """Parse PDF and DOCX resume files"""
    
    @staticmethod
    def extract_text_from_pdf(file_path: str) -> str:
        """Extract text from PDF file"""
        try:
            text = ""
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text += page.extract_text() or ""
            return text
        except Exception as e:
            raise Exception(f"Error parsing PDF: {str(e)}")
    
    @staticmethod
    def extract_text_from_docx(file_path: str) -> str:
        """Extract text from DOCX file"""
        try:
            doc = Document(file_path)
            text = "\n".join([para.text for para in doc.paragraphs])
            return text
        except Exception as e:
            raise Exception(f"Error parsing DOCX: {str(e)}")
    
    @staticmethod
    def extract_text(file_path: str, file_type: str) -> str:
        """Extract text based on file type"""
        if file_type == "pdf":
            return ResumeParser.extract_text_from_pdf(file_path)
        elif file_type in ["docx", "doc"]:
            return ResumeParser.extract_text_from_docx(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")
    
    @staticmethod
    def clean_text(text: str) -> str:
        """Clean extracted text"""
        # Remove extra whitespace
        lines = text.split('\n')
        cleaned = '\n'.join([line.strip() for line in lines if line.strip()])
        return cleaned
    
    @staticmethod
    def parse(file_path: str) -> Tuple[str, str]:
        """Parse resume and return (raw_text, cleaned_text)"""
        # Determine file type
        file_ext = os.path.splitext(file_path)[1].lower().strip('.')
        
        # Extract text
        raw_text = ResumeParser.extract_text(file_path, file_ext)
        
        # Clean text
        cleaned_text = ResumeParser.clean_text(raw_text)
        
        return raw_text, cleaned_text

# Singleton instance
parser = ResumeParser()
