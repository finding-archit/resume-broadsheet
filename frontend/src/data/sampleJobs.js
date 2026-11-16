// SAMPLE DATA: fictional job descriptions and resumes for demonstrations only.
// Loaded from ../sample_data so the frontend, backend tests and README share one copy.
import pythonBackend from '../../../sample_data/job_descriptions/python_backend_developer.txt?raw'
import dataAnalyst from '../../../sample_data/job_descriptions/data_analyst.txt?raw'
import mlEngineer from '../../../sample_data/job_descriptions/machine_learning_engineer.txt?raw'
import frontendDev from '../../../sample_data/job_descriptions/frontend_developer.txt?raw'
import resumePython from '../../../sample_data/resumes/sample_resume_python_developer.txt?raw'
import resumeAnalyst from '../../../sample_data/resumes/sample_resume_data_analyst.txt?raw'
import resumeChef from '../../../sample_data/resumes/sample_resume_unrelated_chef.txt?raw'

export const SAMPLE_JOBS = [
  { id: 'python-backend', title: 'Python Backend Developer', short: 'Backend', text: pythonBackend.trim() },
  { id: 'data-analyst', title: 'Data Analyst', short: 'Analyst', text: dataAnalyst.trim() },
  { id: 'ml-engineer', title: 'Machine Learning Engineer', short: 'ML Eng.', text: mlEngineer.trim() },
  { id: 'frontend', title: 'Frontend Developer', short: 'Frontend', text: frontendDev.trim() },
]

export const SAMPLE_RESUMES = [
  { id: 'python', name: 'Priya Sharma', role: 'Backend developer', note: 'Strong fit for the backend post', text: resumePython.trim() },
  { id: 'analyst', name: 'Arjun Mehta', role: 'Data analyst', note: 'Strong fit for the analyst post', text: resumeAnalyst.trim() },
  { id: 'chef', name: 'Rahul Verma', role: 'Head chef', note: 'Negative control: unrelated', text: resumeChef.trim() },
]
