from flask import Flask, request, jsonify
import joblib
import pandas as pd

import re
import json
from typing import Dict, Optional
from dataclasses import dataclass
import openai
from transformers import pipeline

import io
from werkzeug.utils import secure_filename
import os

# Importar librerías para manejar PDF y DOCX
import PyPDF2
import docx

from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Cargar el preprocesador y el modelo con joblib
preprocessor = joblib.load('preprocessor.pkl')
model = joblib.load('model.pkl')

# Obtener la clave de API de OpenAI desde una variable de entorno
openai_api_key = ""
if not openai_api_key:
    raise Exception("OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.")

@dataclass
class MedicalValue:
    value: str
    unit: Optional[str] = None
    confidence: float = 0.0

class MedicalDataExtractor:
    def __init__(self, openai_api_key: str):
        self.openai_api_key = openai_api_key
        openai.api_key = self.openai_api_key  

        self.ner_pipeline = pipeline("ner", model="dmis-lab/biobert-v1.1", grouped_entities=True)

        self.term_mappings = {
            'edad': 'Age',
            'años': 'Age',
            'sexo': 'Sex',
            'género': 'Sex',
            'dolor_pecho': 'ChestPainType',
            'dolor torácico': 'ChestPainType',
            'presión_arterial': 'RestingBP',
            'tensión': 'RestingBP',
            'colesterol': 'Cholesterol',
            'azúcar en sangre en ayunas': 'FastingBS',
            'ecg': 'RestingECG',
            'frecuencia máxima': 'MaxHR',
            'angina por ejercicio': 'ExerciseAngina',
            'depresión st': 'Oldpeak',
            'pendiente st': 'ST_Slope',
            'enfermedad cardíaca': 'HeartDisease',
        }
        self.unit_patterns = {
            'RestingBP': r'presión arterial (?:en reposo )?(?:es )?(?:de )?(?P<value>\d+)\s*(?P<unit>mmHg|cmHg)',
            'Cholesterol': r'colesterol (?:total )?(?:son )?(?:de )?(?P<value>\d+)\s*(?P<unit>mg/dL|mmol/L)',
            'MaxHR': r'frecuencia cardíaca máxima (?:alcanzada )?(?:fue )?(?:de )?(?P<value>\d+)\s*(?P<unit>lpm|bpm)',
            'RestingHR': r'frecuencia cardíaca (?:en reposo )?(?:se encuentra en )?(?P<value>\d+)\s*(?P<unit>lpm|bpm)',
            'FastingBS': r'glucosa en ayunas (?:se registró en )?(?P<value>\d+)\s*(?P<unit>mg/dL)',
            'Oldpeak': r'depresión del segmento ST (?:se observó en )?(?P<value>\d+\.?\d*)\s*(?P<unit>mm)',
        }


    def extract_with_gpt(self, text: str) -> Dict[str, MedicalValue]:
        """Extrae información usando GPT-4"""
        from openai import OpenAI
    
        client = OpenAI(api_key=self.openai_api_key)
    
        prompt = f"""
        Extrae los siguientes valores médicos del texto, incluyendo sus unidades si están presentes.
        Si no encuentras algún valor, omítelo. Responde en formato JSON.

        Valores a buscar:
        - Age (edad)
        - Sex (sexo)
        - ChestPainType (tipo de dolor en el pecho)
        - RestingBP (presión arterial en reposo)
        - Cholesterol (colesterol)
        - FastingBS (azúcar en sangre en ayunas)
        - RestingECG (ECG en reposo)
        - MaxHR (frecuencia cardíaca máxima)
        - ExerciseAngina (angina por ejercicio)
        - Oldpeak (depresión ST)
        - ST_Slope (pendiente ST)
        - HeartDisease (enfermedad cardíaca)

        Texto: {text}
        """

        try:
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                temperature=0
            )
    
            gpt_content = response.choices[0].message.content.strip()
            print("Respuesta de GPT:")
            print(gpt_content)
    
            gpt_data = json.loads(gpt_content)
    
            extracted_data = {}
            for key, value in gpt_data.items():
                if isinstance(value, dict):
                    extracted_data[key] = MedicalValue(
                        value=value.get('value'),
                        unit=value.get('unit'),
                        confidence=0.9  
                    )
                else:
                    extracted_data[key] = MedicalValue(value=value, confidence=0.9)
            
            return extracted_data

        except json.JSONDecodeError as jde:
            print(f"Error al decodificar JSON de GPT: {jde}")
        except Exception as e:
            print(f"Error procesando la respuesta de GPT: {e}")
    
        return {}

    def extract_with_regex(self, text: str) -> Dict[str, MedicalValue]:
        """Extrae información usando expresiones regulares"""
        results = {}
        
        for field, pattern in self.unit_patterns.items():
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                results[field] = MedicalValue(
                    value=match.group('value'),
                    unit=match.group('unit'),
                    confidence=1.0  
                )
                
        return results

    def extract_with_ner(self, text: str) -> Dict[str, MedicalValue]:
        """Extrae información usando el modelo de NER"""
        entities = self.ner_pipeline(text)
        results = {}
        
        for entity in entities:
            label = entity['entity_group']
            for spanish_term, english_term in self.term_mappings.items():
                if english_term.lower() == label.lower():
                    current_value = results.get(english_term)
                    if (not current_value) or (current_value.confidence < entity['score']):
                        results[english_term] = MedicalValue(
                            value=entity['word'],
                            confidence=entity['score']
                        )
        return results

    def extract(self, text: str) -> Dict[str, MedicalValue]:
        """Combina todos los métodos de extracción"""
        gpt_results = self.extract_with_gpt(text)
        regex_results = self.extract_with_regex(text)
        ner_results = self.extract_with_ner(text)
        final_results = {}
        all_results = [gpt_results, regex_results, ner_results]

        for field in set().union(*[r.keys() for r in all_results]):
            values = [r.get(field) for r in all_results if field in r]
            if values:
                final_results[field] = max(values, key=lambda x: x.confidence)
        return final_results

# Crear una instancia de MedicalDataExtractor
extractor = MedicalDataExtractor(openai_api_key)

# Extensiones de archivo permitidas
ALLOWED_EXTENSIONS = {'pdf', 'docx'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(file):
    try:
        pdf_reader = PyPDF2.PdfReader(file)
        text = ''
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            text += page.extract_text()
        return text
    except Exception as e:
        raise Exception(f"Error al leer el archivo PDF: {str(e)}")

def extract_text_from_docx(file):
    try:
        doc = docx.Document(file)
        text = '\n'.join([para.text for para in doc.paragraphs])
        return text
    except Exception as e:
        raise Exception(f"Error al leer el archivo DOCX: {str(e)}")

@app.route('/extract', methods=['POST'])
def extract():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No se encontró el archivo en la solicitud"}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({"error": "No se seleccionó ningún archivo"}), 400

        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file_extension = filename.rsplit('.', 1)[1].lower()

            # Leer el contenido del archivo y extraer texto
            if file_extension == 'pdf':
                text = extract_text_from_pdf(file)
            elif file_extension == 'docx':
                text = extract_text_from_docx(file)
            else:
                return jsonify({"error": "Tipo de archivo no soportado"}), 400

            # Usar MedicalDataExtractor para extraer datos
            # # Después de extraer el texto
            print("Texto extraído del archivo:")
            print(text)

            results = extractor.extract(text)

            # Preparar resultados para devolver
            output = {}
            for field, value in results.items():
                output[field] = {
                    "value": value.value,
                    "unit": value.unit,
                    "confidence": value.confidence
                }

            return jsonify(output), 200
        else:
            return jsonify({"error": "Tipo de archivo inválido"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "No se recibieron datos"}), 400

        # Procesar los datos
        input_data = pd.DataFrame([data])
        processed_data = preprocessor.transform(input_data)

        # Hacer la predicción
        prediction = model.predict(processed_data)[0]
        prediction_proba = model.predict_proba(processed_data)[0]

        result = {
            "Predicción": "Presencia de ataque al corazón" if prediction == 1 else "Ausencia de ataque al corazón",
            "Probabilidad_Ausencia": round(prediction_proba[0], 2),
            "Probabilidad_Presencia": round(prediction_proba[1], 2)
        }
        return jsonify(result)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

