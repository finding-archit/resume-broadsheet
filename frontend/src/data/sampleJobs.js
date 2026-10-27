// SAMPLE DATA: fictional job descriptions for demonstrations only.
// Loaded from ../sample_data so the frontend, backend tests and README share one copy.
import pythonBackend from '../../../sample_data/job_descriptions/python_backend_developer.txt?raw'
import dataAnalyst from '../../../sample_data/job_descriptions/data_analyst.txt?raw'
import mlEngineer from '../../../sample_data/job_descriptions/machine_learning_engineer.txt?raw'
import frontendDev from '../../../sample_data/job_descriptions/frontend_developer.txt?raw'
import sampleResume from '../../../sample_data/resumes/sample_resume_python_developer.txt?raw'

export const SAMPLE_JOBS = [
  { id: 'python-backend', title: 'Python Backend Developer', text: pythonBackend.trim() },
  { id: 'data-analyst', title: 'Data Analyst', text: dataAnalyst.trim() },
  { id: 'ml-engineer', title: 'Machine Learning Engineer', text: mlEngineer.trim() },
  { id: 'frontend', title: 'Frontend Developer', text: frontendDev.trim() },
]

export const SAMPLE_RESUME_TEXT = sampleResume.trim()
