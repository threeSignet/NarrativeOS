// narrative-os/apps/web/src/components/ProposalGroupSelector.tsx
import { useHatchStore } from '../stores/hatch'

export function ProposalGroupSelector() {
  const store = useHatchStore()
  const { currentProposalGroup, selectedOptionId } = store

  if (currentProposalGroup.length <= 1) return null

  return (
    <div className="proposal-group-selector bg-gray-50 border rounded-lg p-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        AI 提供了 {currentProposalGroup.length} 个方案，请选择一个
      </h3>
      <div className="space-y-2">
        {currentProposalGroup.map((proposal) => (
          <div
            key={proposal.id}
            className={`cursor-pointer border rounded-md p-3 transition-colors ${
              selectedOptionId === proposal.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300 hover:bg-white'
            }`}
            onClick={() => store.selectOption(proposal.id)}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">{proposal.title}</h4>
              {selectedOptionId === proposal.id && (
                <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded">
                  已选择
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1 line-clamp-3">
              {proposal.content?.reasoning || proposal.reasoning || '无推荐理由'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
