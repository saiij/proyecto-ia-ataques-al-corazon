'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { AlertCircle } from 'lucide-react'

export default function HeartDiseaseRiskForm() {
  const [formData, setFormData] = useState({
    age: '',
    sex: '',
    trtbps: '',
    chol: '',
    thalachh: '',
    oldpeak: '',
    exng: '',
    caa: '',
    cp: '',
    fbs: '',
    restecg: '',
    slp: '',
    thall: ''
  })
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<number | null>(null)
  const [fileData, setFileData] = useState<any>(null)
  const [fileError, setFileError] = useState<string | null>(null)



  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFile = e.target.files[0]
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

      if (allowedTypes.includes(selectedFile.type)) {
        setFile(selectedFile)
        setFileError(null)
      } else {
        setFile(null)
        setFileError('Por favor, sube un archivo PDF o DOCX.')
      }
    }
  }

  const handleFileUpload = async () => {
    if (file) {
      const formDataFile = new FormData()
      formDataFile.append('file', file)

      try {
        const response = await fetch('http://localhost:5000/extract', {
          method: 'POST',
          body: formDataFile
        })

        if (!response.ok) {
          throw new Error('Error en la respuesta del servidor')
        }

        const data = await response.json()
        setFileData(data)

        // Aquí es donde mapearemos los datos extraídos al formData
        mapExtractedDataToFormData(data)

      } catch (error) {
        console.error('Error al enviar el archivo:', error)
        setFileError('Hubo un error al procesar el archivo. Por favor, inténtalo de nuevo.')
      }
    }
  }
  const mapExtractedDataToFormData = (extractedData) => {
    // Creamos un objeto para actualizar formData
    const updatedFormData = { ...formData }

    // Mapeamos cada campo extraído al campo correspondiente en formData
    // Necesitaremos convertir y limpiar los datos según sea necesario

    // Edad
    if (extractedData.Age?.value) {
      const ageMatch = extractedData.Age.value.match(/\d+/)
      if (ageMatch) {
        updatedFormData.age = ageMatch[0]
      }
    }

    // Sexo
    if (extractedData.Sex?.value) {
      const sexValue = extractedData.Sex.value.toLowerCase()
      if (sexValue.includes('femenino')) {
        updatedFormData.sex = '0'
      } else if (sexValue.includes('masculino')) {
        updatedFormData.sex = '1'
      }
    }

    // Presión Arterial en Reposo (RestingBP)
    if (extractedData.RestingBP?.value) {
      const bpMatch = extractedData.RestingBP.value.match(/\d+/)
      if (bpMatch) {
        updatedFormData.trtbps = bpMatch[0]
      }
    }

    // Colesterol (Cholesterol)
    if (extractedData.Cholesterol?.value) {
      const cholMatch = extractedData.Cholesterol.value.match(/\d+/)
      if (cholMatch) {
        updatedFormData.chol = cholMatch[0]
      }
    }

    // Frecuencia Cardíaca Máxima (MaxHR)
    if (extractedData.MaxHR?.value) {
      const hrMatch = extractedData.MaxHR.value.match(/\d+/)
      if (hrMatch) {
        updatedFormData.thalachh = hrMatch[0]
      }
    }

    // Depresión del Segmento ST (Oldpeak)
    if (extractedData.Oldpeak?.value) {
      const oldpeakMatch = extractedData.Oldpeak.value.match(/[\d.]+/)
      if (oldpeakMatch) {
        updatedFormData.oldpeak = oldpeakMatch[0]
      }
    }

    // Angina Inducida por Ejercicio (ExerciseAngina)
    if (extractedData.ExerciseAngina?.value) {
      const anginaValue = extractedData.ExerciseAngina.value.toLowerCase()
      if (anginaValue.includes('no') || anginaValue.includes('ausencia')) {
        updatedFormData.exng = '0'
      } else if (anginaValue.includes('sí') || anginaValue.includes('si') || anginaValue.includes('presencia')) {
        updatedFormData.exng = '1'
      }
    }

    // Tipo de Dolor en el Pecho (ChestPainType)
    if (extractedData.ChestPainType?.value) {
      const cpValue = extractedData.ChestPainType.value.toLowerCase()
      if (cpValue.includes('angina típica')) {
        updatedFormData.cp = '1'
      } else if (cpValue.includes('angina atípica')) {
        updatedFormData.cp = '2'
      } else if (cpValue.includes('dolor no anginoso')) {
        updatedFormData.cp = '3'
      } else if (cpValue.includes('asintomático')) {
        updatedFormData.cp = '4'
      } else if (cpValue.includes('dolor torácico no típico')) {
        updatedFormData.cp = '2' // Asumimos que "dolor torácico no típico" es "angina atípica"
      }
    }

    // Azúcar en Sangre en Ayunas mayor a 120 mg/dL (FastingBS)
    if (extractedData.FastingBS?.value) {
      const fbsValue = extractedData.FastingBS.value.match(/\d+/)
      if (fbsValue) {
        updatedFormData.fbs = parseInt(fbsValue[0], 10) > 120 ? '1' : '0'
      }
    }

    // Resultados del ECG en Reposo (RestingECG)
    if (extractedData.RestingECG?.value) {
      const ecgValue = extractedData.RestingECG.value.toLowerCase()
      if (ecgValue.includes('normal')) {
        updatedFormData.restecg = '0'
      } else if (ecgValue.includes('anormalidad') || ecgValue.includes('ondas t invertidas')) {
        updatedFormData.restecg = '1'
      } else if (ecgValue.includes('hipertrofia ventricular')) {
        updatedFormData.restecg = '2'
      }
    }

    // Pendiente del Segmento ST (ST_Slope)
    if (extractedData.ST_Slope?.value) {
      const slopeValue = extractedData.ST_Slope.value.toLowerCase()
      if (slopeValue.includes('ascendente')) {
        updatedFormData.slp = '1'
      } else if (slopeValue.includes('plano')) {
        updatedFormData.slp = '2'
      } else if (slopeValue.includes('descendente')) {
        updatedFormData.slp = '3'
      }
    }

    setFormData(updatedFormData)
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null) // Resetea el resultado antes de enviar

    const payload = {
      age: parseInt(formData.age, 10),
      sex: parseInt(formData.sex, 10),
      trtbps: parseInt(formData.trtbps, 10),
      chol: parseInt(formData.chol, 10),
      thalachh: parseInt(formData.thalachh, 10),
      oldpeak: parseFloat(formData.oldpeak),
      exng: parseInt(formData.exng, 10),
      caa: parseInt(formData.caa, 10),
      cp: parseInt(formData.cp, 10),
      fbs: parseInt(formData.fbs, 10),
      restecg: parseInt(formData.restecg, 10),
      slp: parseInt(formData.slp, 10),
      thall: parseInt(formData.thall, 10)
    }
    console.log(payload)

    try {
      const response = await fetch('http://localhost:5000/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error('Error en la respuesta del servidor')
      }

      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error('Error al enviar los datos:', error)
      alert('Hubo un error al calcular el riesgo. Por favor, inténtalo de nuevo.')
    }



  }
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Evaluación de Riesgo de Enfermedad Cardíaca</h1>
      <Tabs defaultValue="form">
        <TabsList className="mb-4">
          <TabsTrigger value="form">Formulario Manual</TabsTrigger>
          <TabsTrigger value="file">Subir Archivo</TabsTrigger>
        </TabsList>
        <TabsContent value="form">
          <div className="flex flex-col md:flex-row gap-4">
            <form onSubmit={handleSubmit} className="space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Edad (años):</Label>
                  <Input
                    id="age"
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleChange}
                    min="1"
                    max="120"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sex">Sexo:</Label>
                  <Select name="sex" value={formData.sex} onValueChange={(value) => handleSelectChange('sex', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Femenino</SelectItem>
                      <SelectItem value="1">Masculino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trtbps">Presión Arterial en Reposo (mm Hg):</Label>
                  <Input
                    id="trtbps"
                    type="number"
                    name="trtbps"
                    value={formData.trtbps}
                    onChange={handleChange}
                    min="50"
                    max="200"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chol">Colesterol (mg/dL):</Label>
                  <Input
                    id="chol"
                    type="number"
                    name="chol"
                    value={formData.chol}
                    onChange={handleChange}
                    min="100"
                    max="600"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="thalachh">Frecuencia Cardíaca Máxima Alcanzada (lpm):</Label>
                  <Input
                    id="thalachh"
                    type="number"
                    name="thalachh"
                    value={formData.thalachh}
                    onChange={handleChange}
                    min="50"
                    max="220"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="oldpeak">Depresión del Segmento ST (mm):</Label>
                  <Input
                    id="oldpeak"
                    type="number"
                    step="0.1"
                    name="oldpeak"
                    value={formData.oldpeak}
                    onChange={handleChange}
                    min="0.0"
                    max="10.0"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exng">Angina Inducida por Ejercicio:</Label>
                  <Select name="exng" value={formData.exng} onValueChange={(value) => handleSelectChange('exng', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No</SelectItem>
                      <SelectItem value="1">Sí</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="caa">Número de Vasos Principales Coloreados (0-4):</Label>
                  <Input
                    id="caa"
                    type="number"
                    name="caa"
                    value={formData.caa}
                    onChange={handleChange}
                    min="0"
                    max="4"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cp">Tipo de Dolor en el Pecho:</Label>
                  <Select name="cp" value={formData.cp} onValueChange={(value) => handleSelectChange('cp', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Angina típica</SelectItem>
                      <SelectItem value="1">Angina atípica</SelectItem>
                      <SelectItem value="2">Dolor no anginoso</SelectItem>
                      <SelectItem value="3">Asintomático</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fbs">Azúcar en Sangre en Ayunas mayor a 120 mg/dL:</Label>
                  <Select name="fbs" value={formData.fbs} onValueChange={(value) => handleSelectChange('fbs', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No</SelectItem>
                      <SelectItem value="1">Sí</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="restecg">Resultados del ECG en Reposo:</Label>
                  <Select name="restecg" value={formData.restecg} onValueChange={(value) => handleSelectChange('restecg', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Normal</SelectItem>
                      <SelectItem value="1">Anormalidad del segmento ST-T</SelectItem>
                      <SelectItem value="2">Hipertrofia ventricular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slp">Pendiente del Segmento ST:</Label>
                  <Select name="slp" value={formData.slp} onValueChange={(value) => handleSelectChange('slp', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Ascendente</SelectItem>
                      <SelectItem value="1">Plano</SelectItem>
                      <SelectItem value="2">Descendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="thall">Thalassemia:</Label>
                  <Select name="thall" value={formData.thall} onValueChange={(value) => handleSelectChange('thall', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Normal</SelectItem>
                      <SelectItem value="1">Defecto fijo</SelectItem>
                      <SelectItem value="2">Defecto reversible</SelectItem>
                      <SelectItem value="3">No disponible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit">Enviar</Button>
            </form>
            <ResultCard result={result} />
          </div>
        </TabsContent>
        <TabsContent value="file">
          <div className="flex flex-col md:flex-row gap-4">
            <Card className="flex-1">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="file-upload">Subir documento (PDF o DOCX):</Label>
                    <Input id="file-upload" type="file" onChange={handleFileChange} accept=".pdf,.docx" />
                  </div>
                  {fileError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{fileError}</AlertDescription>
                    </Alert>
                  )}
                  <Button onClick={handleFileUpload} disabled={!file}>Procesar Archivo</Button>
                </div>
                {fileData && (
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold mb-2">Los datos extraídos se han aplicado al formulario. Por favor, revísalos antes de enviar.</h3>
                    {/* Puedes mostrar los datos extraídos si lo deseas */}
                    {/* O simplemente informar al usuario */}
                  </div>
                )}
              </CardContent>
            </Card>
            <ResultCard result={result} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ResultCard({ result }: { result: number | null }) {
  return (
    <Card className="flex-1">
      <CardContent className="flex flex-col items-center justify-center h-full">
        <h2 className="text-xl font-semibold mb-4">Resultado</h2>
        {result !== null && (
          <div className="flex flex-col items-center">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle
                  className="text-gray-200 stroke-current"
                  strokeWidth="10"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                ></circle>
                <circle
                  className="text-blue-600 progress-ring__circle stroke-current"
                  strokeWidth="10"
                  strokeLinecap="round"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  strokeDasharray={`${(result.Probabilidad_Presencia * 100 * 2.51327)} 251.327`}
                  strokeDashoffset="0"
                ></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">
                  {(result.Probabilidad_Presencia * 100).toFixed(1)}%
                </span>
                <p className="text-center mt-2">{"Probabilida de ataque al corazon"}</p>
              </div>
            </div>
          </div>
        )}
        {result === null && <p>Complete el formulario o suba un archivo para ver el resultado</p>}
      </CardContent>
    </Card>
  )
}




