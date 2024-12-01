# medical_extractor.py

import re
import json
from typing import Dict, Optional
from dataclasses import dataclass
import openai
from transformers import pipeline

@dataclass
class MedicalValue:
    value: str
    unit: Optional[str] = None
    confidence: float = 0.0

class MedicalDataExtractor:
    def __init__(self, openai_api_key: str):
        """
        Inicializa el extractor de datos médicos.
        
        Args:
            openai_api_key (str): API key de OpenAI
        """
        self.openai_api_key = openai_api_key
        openai.api_key = self.openai_api_key

        # Inicializar el pipeline de NER
        try:
            self.ner_pipeline = pipeline("ner", 
                                       model="dmis-lab/biobert-v1.1", 
                                       grouped_entities=True)
        except Exception as e:
            print(f"Error al cargar el modelo NER: {e}")
            self.ner_pipeline = None

        # Mapeo de términos español-inglés
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
            'glucosa': 'FastingBS',
            'ecg': 'RestingECG',
            'frecuencia máxima': 'MaxHR',
            'frecuencia cardíaca': 'MaxHR',
            'angina por ejercicio': 'ExerciseAngina',
            'depresión st': 'Oldpeak',
            'pendiente st': 'ST_Slope',
            'enfermedad cardíaca': 'HeartDisease'
        }
        
        # Patrones para unidades
        self.unit_patterns = {
            'RestingBP': r'(?P<value>\d+)\s*(?P<unit>mm[Hh]g|cmHg)',
            'Cholesterol': r'(?P<value>\d+)\s*(?P<unit>mm/dl|mg/dl)',
            'MaxHR': r'(?P<value>\d+)\s*(?P<unit>bpm|lpm)',
            'FastingBS': r'(?P<value>\d+)\s*(?P<unit>mg/dl)',
            'Oldpeak': r'(?P<value>\d+\.?\d*)\s*(?P<unit>mm|mv)',
            'Age': r'(?P<value>\d+)\s*(?P<unit>años|year)'
        }

    def extract_with_gpt(self, text: str) -> Dict[str, MedicalValue]:
        """
        Extrae información médica usando GPT-4.
        """
        prompt = f"""
        Extrae los siguientes valores médicos del texto, incluyendo sus unidades si están presentes.
        Si no encuentras algún valor, omítelo. Responde en formato JSON.

        Valores a buscar:
        - Age (edad)
        - Sex (sexo/género, M/F o 1/0)
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
            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                temperature=0
            )
            
            gpt_content = response.choices[0].message.content.strip()
            gpt_data = json.loads(gpt_content)
            
            extracted_data = {}
            for key, value in gpt_data.items():
                if isinstance(value, dict):
                    extracted_data[key] = MedicalValue(
                        value=str(value.get('value')),
                        unit=value.get('unit'),
                        confidence=0.9
                    )
                else:
                    extracted_data[key] = MedicalValue(
                        value=str(value),
                        confidence=0.9
                    )
                    
            return extracted_data

        except Exception as e:
            print(f"Error en extract_with_gpt: {e}")
            return {}

    def extract_with_regex(self, text: str) -> Dict[str, MedicalValue]:
        """
        Extrae información usando expresiones regulares.
        """
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
        """
        Extrae información usando el modelo de NER.
        """
        if not self.ner_pipeline:
            return {}
            
        try:
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
            
        except Exception as e:
            print(f"Error en extract_with_ner: {e}")
            return {}

    def extract(self, text: str) -> Dict[str, MedicalValue]:
        """
        Combina todos los métodos de extracción.
        
        Args:
            text (str): Texto del cual extraer información
            
        Returns:
            Dict[str, MedicalValue]: Diccionario con los valores extraídos
        """
        # Obtener resultados de cada método
        gpt_results = self.extract_with_gpt(text)
        regex_results = self.extract_with_regex(text)
        ner_results = self.extract_with_ner(text)
        
        # Combinar resultados
        final_results = {}
        all_results = [gpt_results, regex_results, ner_results]

        # Para cada campo encontrado en cualquiera de los resultados
        for field in set().union(*[r.keys() for r in all_results]):
            # Obtener todos los valores para ese campo
            values = [r.get(field) for r in all_results if field in r]
            if values:
                # Seleccionar el valor con mayor confianza
                final_results[field] = max(values, key=lambda x: x.confidence)

        return final_results

def main():
    """Función de prueba"""
    extractor = MedicalDataExtractor("tu-api-key-aqui")
    texto_ejemplo = """
    Se presenta paciente masculino de 62 años con historial de tabaquismo y 
    colesterol elevado (250 mg/dl). Refiere dolor torácico opresivo que comenzó 
    durante el esfuerzo físico intenso. La presión arterial registrada en reposo 
    es de 145 mmHg. La glucosa en ayunas fue de 160 mg/dl.
    """
    resultados = extractor.extract(texto_ejemplo)
    
    print("\nResultados extraídos:")
    for campo, valor in resultados.items():
        print(f"{campo}: {valor.value} {valor.unit or ''} (confianza: {valor.confidence:.2f})")

if __name__ == "__main__":
    main()
