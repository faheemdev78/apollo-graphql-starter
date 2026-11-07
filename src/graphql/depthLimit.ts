import { GraphQLError, Kind, type SelectionSetNode, type ValidationRule } from 'graphql';

export function depthLimit(maxDepth: number): ValidationRule {
  return (context) => {
    function measure(selectionSet: SelectionSetNode | undefined, depth: number, seen: Set<string>) {
      if (!selectionSet) return;
      for (const selection of selectionSet.selections) {
        if (selection.kind === Kind.FIELD) {
          if (selection.name.value.startsWith('__')) continue;
          const next = depth + 1;
          if (next > maxDepth) {
            context.reportError(
              new GraphQLError(
                `Query is too deep: field "${selection.name.value}" is at depth ${next}, above the maximum of ${maxDepth}.`,
                { nodes: [selection], extensions: { code: 'DEPTH_LIMIT_EXCEEDED', maxDepth } },
              ),
            );
            continue;
          }
          measure(selection.selectionSet, next, seen);
        } else if (selection.kind === Kind.INLINE_FRAGMENT) {
          measure(selection.selectionSet, depth, seen);
        } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
          if (seen.has(selection.name.value)) continue;
          const nextSeen = new Set(seen);
          nextSeen.add(selection.name.value);
          const fragment = context.getFragment(selection.name.value);
          measure(fragment?.selectionSet, depth, nextSeen);
        }
      }
    }

    return {
      OperationDefinition(node) {
        measure(node.selectionSet, 0, new Set());
      },
    };
  };
}
