import type { Project } from '../../stores/projects'
import ProjectCard from './ProjectCard'

interface ProjectGridProps {
  projects: Project[]
  onSelect: (id: string) => void
  onContextMenu: (e: React.MouseEvent, project: Project) => void
}

export default function ProjectGrid({ projects, onSelect, onContextMenu }: ProjectGridProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: 16,
    }}>
      {projects.map((project, i) => (
        <ProjectCard
          key={project.id}
          project={project}
          onClick={onSelect}
          onContextMenu={onContextMenu}
          index={i}
        />
      ))}
    </div>
  )
}
